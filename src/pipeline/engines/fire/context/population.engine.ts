import { createPopulationService } from '@/modules/territory/population/population.service'
import {
  buildPopulationContextVersion,
  POPULATION_DEFAULT_BUFFER_RADII_M,
  POPULATION_FALLBACK_POLICY,
  POPULATION_PRIMARY_VARIANT,
  POPULATION_VALIDATION_VARIANT,
} from '@/modules/territory/population/population-context-version'
import { resolvePopulationAdminService } from '@/modules/territory/population/admin/population-admin.service'
import { findNearestSettlementsAtPoint } from '@/modules/territory/population/admin/settlement-index'
import { buildPopulationEstimateConfidence } from '@/modules/territory/population/population-estimate-confidence'
import type { GeoPoint, PopulationWarningCode } from '@/modules/territory/population/population.types'
import { WORLDPOP_ANALYSIS_METHOD_VERSION } from '@/modules/territory/population/providers/worldpop/worldpop.manifest'
import { buildPopulationComparison } from '@/modules/territory/population/raster/population-variant-compare'
import { fetchEventDetections, getLandCoverZones } from '@/pipeline/stores/land-cover.store'
import {
  listPopulationEventCandidates,
  persistPopulationContext,
  type PopulationContextStatus,
  type PopulationEventCandidate,
} from '@/pipeline/stores/population.store'

export class PopulationSourceUnavailableError extends Error {
  constructor(message = 'Raster WorldPop no disponible') {
    super(message)
    this.name = 'PopulationSourceUnavailableError'
  }
}

export interface PopulationEnrichResultRow {
  event_id: string
  department_name: string | null
  status: PopulationContextStatus
  population_500m: number | null
  population_1000m: number | null
  warnings: PopulationWarningCode[]
  duration_ms: number
  geometry_source: 'detections' | 'event_centroid_fallback'
}

export interface PopulationRuntimeContext {
  contextVersion: string
  radiiM: number[]
  referenceYear: number
  rasterHash: string
}

function parseRadiiM(): number[] {
  return [...POPULATION_DEFAULT_BUFFER_RADII_M]
}

function resolveSamplePoints(
  detections: Array<{ id: string; latitude: number; longitude: number }>,
  centroid: { lat: number; lon: number } | null,
): { points: GeoPoint[]; geometrySource: 'detections' | 'event_centroid_fallback' } {
  if (detections.length > 0) {
    return {
      points: detections.map((d) => ({ id: d.id, lat: d.latitude, lon: d.longitude })),
      geometrySource: 'detections',
    }
  }
  if (centroid) {
    return {
      points: [{ lat: centroid.lat, lon: centroid.lon, id: 'centroid' }],
      geometrySource: 'event_centroid_fallback',
    }
  }
  return { points: [], geometrySource: 'event_centroid_fallback' }
}

export function eventNeedsPopulationEnrichment(
  event: PopulationEventCandidate,
  contextVersion: string,
  force: boolean,
): boolean {
  if (force) return true
  if (!event.context_version) return true
  if (event.context_version !== contextVersion) return true
  if (
    event.last_linked_at &&
    event.context_generated_at &&
    event.last_linked_at > event.context_generated_at
  ) {
    return true
  }
  return false
}

export async function resolvePopulationRuntime(): Promise<PopulationRuntimeContext> {
  const radiiM = parseRadiiM()
  const service = createPopulationService()
  const status = await service.getSourceStatus()
  if (!status.isReady || !status.rasterHash) {
    throw new PopulationSourceUnavailableError()
  }

  const contextVersion = buildPopulationContextVersion({
    sourceCode: status.sourceCode,
    sourceVersion: status.sourceVersion,
    productType: 'dual_use',
    rasterHash: status.rasterHash,
    referenceYear: status.referenceYear,
    analysisMethodVersion: WORLDPOP_ANALYSIS_METHOD_VERSION,
    crs: status.operationalCrs ?? 'LAEA-GT',
    resamplingMethod: 'sum',
    zoneRadiiM: radiiM,
    fallbackPolicy: POPULATION_FALLBACK_POLICY,
    primaryVariant: POPULATION_PRIMARY_VARIANT,
    validationVariant: POPULATION_VALIDATION_VARIANT,
    adjustmentMethod: 'none',
    settlementDatasetVersion: 'hdx_cod_ab_municipal_seats',
  })

  return {
    contextVersion,
    radiiM,
    referenceYear: status.referenceYear,
    rasterHash: status.rasterHash,
  }
}

export async function enrichPopulationForEvent(
  eventId: string,
  runtime?: PopulationRuntimeContext,
): Promise<PopulationEnrichResultRow> {
  const started = Date.now()
  const ctx = runtime ?? (await resolvePopulationRuntime())
  const candidates = await listPopulationEventCandidates(10000)
  const event = candidates.find((c) => c.id === eventId)
  if (!event) throw new Error('Evento no encontrado')

  const detections = await fetchEventDetections(eventId)
  const centroid =
    event.centroid_lat != null && event.centroid_lng != null
      ? { lat: event.centroid_lat, lon: event.centroid_lng }
      : null
  const { points, geometrySource } = resolveSamplePoints(detections, centroid)
  if (points.length === 0) throw new Error('Evento sin detecciones ni centroide utilizable')

  const service = createPopulationService()
  const warnings: PopulationWarningCode[] = []
  if (geometrySource === 'event_centroid_fallback') {
    warnings.push('centroid_fallback')
  }

  let analysis
  try {
    analysis = await service.analyzeBuffers({
      points,
      radiiMeters: ctx.radiiM,
      includeValidation: true,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'PopulationServiceNotReadyError') {
      throw new PopulationSourceUnavailableError()
    }
    throw err
  }

  if (analysis.status === 'unavailable' || analysis.status === 'error') {
    throw new PopulationSourceUnavailableError()
  }

  for (const w of analysis.warnings) {
    if (!warnings.includes(w.code)) warnings.push(w.code)
  }

  const zone500 = analysis.buffers.find((b) => b.radiusM === 500)
  const zone1000 = analysis.buffers.find((b) => b.radiusM === 1000)
  const largeDiffZones = analysis.buffers.filter((b) => {
    if (b.validationEstimate == null || b.estimatedPopulation <= 0) return false
    const cmp = buildPopulationComparison(b.estimatedPopulation, b.validationEstimate)
    return Math.abs(cmp.percentageDifference) > 20
  })
  if (largeDiffZones.length > 0) warnings.push('large_model_difference')
  if (!zone500 || !zone1000) warnings.push('partial_coverage')

  let officialContext: Record<string, unknown> = { status: 'not_available' }
  try {
    const admin = await resolvePopulationAdminService()
    if (event.department_code) {
      const adminCtx = await admin.getAdministrativeContext({
        departmentCode: event.department_code,
        referenceYear: ctx.referenceYear,
      })
      officialContext = {
        status: adminCtx.status,
        department: adminCtx.department,
        municipality: adminCtx.municipality,
        temporal_alignment: adminCtx.temporalAlignment,
        reference_year: adminCtx.referenceYear,
      }
      if (adminCtx.status === 'not_available') warnings.push('official_context_unavailable')
      if (adminCtx.warnings?.some((w) => w.code === 'official_year_mismatch')) {
        warnings.push('official_year_mismatch' as PopulationWarningCode)
      }
    } else {
      warnings.push('official_context_unavailable')
    }
  } catch {
    warnings.push('official_context_unavailable')
  }

  const refPoint = points[0]!
  const nearest = findNearestSettlementsAtPoint(refPoint.lat, refPoint.lon, 5)
  if (!nearest.length) {
    warnings.push('settlement_source_unavailable')
  } else {
    warnings.push('settlement_dataset_limited_to_municipal_seats')
  }

  let landCoverZones: Awaited<ReturnType<typeof getLandCoverZones>> = []
  try {
    landCoverZones = await getLandCoverZones(eventId)
  } catch {
    /* land cover optional for confidence reasons */
  }

  const zoneConfidenceSummary: Record<string, Record<string, unknown>> = {}
  let scaleSensitive = false

  for (const buffer of analysis.buffers) {
    const lcZone = landCoverZones.find((z) => z.radius_m === buffer.radiusM)
    const confidence = buildPopulationEstimateConfidence({
      primaryEstimate: buffer.estimatedPopulation,
      validationEstimate: buffer.validationEstimate,
      territorial: {
        radiusM: buffer.radiusM,
        dataCoveragePct: buffer.dataCoveragePct,
        validPixelCountEstimate: buffer.analyzedAreaHa
          ? Math.round(buffer.analyzedAreaHa)
          : undefined,
        partialCoverage: buffer.dataCoveragePct < 90,
        builtUpFractionPct: lcZone?.built_up_pct ?? undefined,
        settlementDatasetLimited: true,
      },
    })
    if (confidence.reasons.includes('local_estimate_scale_sensitive')) {
      scaleSensitive = true
    }
    zoneConfidenceSummary[String(buffer.radiusM)] = {
      level: confidence.level,
      agreement_class: confidence.agreementClass,
      recommended_display_mode: confidence.recommendedDisplayMode,
      reasons: confidence.reasons,
      built_up_fraction_pct: lcZone?.built_up_pct ?? null,
      ratio_between_models: confidence.ratioBetweenModels,
      percentage_difference: confidence.percentageDifference,
    }
  }

  if (scaleSensitive) {
    warnings.push('local_estimate_scale_sensitive')
  }

  let status: PopulationContextStatus = 'complete'
  if (warnings.includes('centroid_fallback') || warnings.includes('partial_coverage')) {
    status = 'partial'
  }
  if (warnings.includes('validation_source_unavailable') || analysis.buffers.every((b) => !b.validationEstimate)) {
    status = 'partial'
    warnings.push('validation_source_unavailable')
  }
  if (!zone500?.estimatedPopulation && !zone1000?.estimatedPopulation) {
    status = 'unavailable'
  }

  const zones = analysis.buffers.map((buffer) => {
    const comparison =
      buffer.validationEstimate != null
        ? buildPopulationComparison(buffer.estimatedPopulation, buffer.validationEstimate)
        : null
    return {
      radiusM: buffer.radiusM,
      estimatedPopulation: buffer.estimatedPopulation,
      validationEstimate: buffer.validationEstimate,
      absoluteDifference: comparison?.absoluteDifference,
      differencePct: comparison?.percentageDifference,
      densityPerKm2: buffer.densityPerKm2,
      analyzedAreaHa: buffer.analyzedAreaHa,
      dataCoveragePct: buffer.dataCoveragePct,
      warnings: (buffer.warnings ?? []).map((w) => w.code),
    }
  })

  const km1 = analysis.buffers.find((b) => b.radiusM === 1000)
  await persistPopulationContext({
    entityType: 'fire_event',
    entityId: eventId,
    contextVersion: ctx.contextVersion,
    referenceYear: ctx.referenceYear,
    geometrySource,
    status,
    estimatedPopulation: km1?.estimatedPopulation ?? zone1000?.estimatedPopulation ?? null,
    validationSummary: {
      constrained_unconstrained_large_difference: largeDiffZones.length > 0,
      zones_compared: analysis.buffers.filter((b) => b.validationEstimate != null).length,
      zones: zoneConfidenceSummary,
    },
    officialContext,
    nearestSettlements: nearest.map((s) => ({
      name: s.name,
      type: s.settlementType ?? 'municipal_seat',
      distance_m: s.distanceM,
      department: s.departmentName,
      municipality: s.municipalityName,
      source: s.source,
      location_accuracy: 'admin_centroid',
      population_reference: s.populationReported,
      reference_year: s.referenceYear,
    })),
    warnings: [...new Set(warnings)],
    generatedAt: analysis.generatedAt,
    zones,
  })

  return {
    event_id: eventId,
    department_name: event.department_name,
    status,
    population_500m: zone500?.estimatedPopulation ?? null,
    population_1000m: zone1000?.estimatedPopulation ?? null,
    warnings,
    duration_ms: Date.now() - started,
    geometry_source: geometrySource,
  }
}

export async function runPopulationEnrichment(input: {
  limit?: number
  force?: boolean
  eventId?: string
}): Promise<{
  events_considered: number
  events_enriched: number
  events_unchanged: number
  events_failed: number
  duration_ms: number
  context_version: string | null
  results: PopulationEnrichResultRow[]
}> {
  const started = Date.now()
  const runtime = await resolvePopulationRuntime()
  let candidates = await listPopulationEventCandidates(input.limit ?? 10000)
  if (input.eventId) candidates = candidates.filter((c) => c.id === input.eventId)

  const toProcess = candidates.filter((e) =>
    eventNeedsPopulationEnrichment(e, runtime.contextVersion, input.force ?? false),
  )

  const results: PopulationEnrichResultRow[] = []
  let events_failed = 0

  for (const event of toProcess) {
    try {
      results.push(await enrichPopulationForEvent(event.id, runtime))
    } catch {
      events_failed += 1
    }
  }

  return {
    events_considered: candidates.length,
    events_enriched: results.length,
    events_unchanged: candidates.length - toProcess.length,
    events_failed,
    duration_ms: Date.now() - started,
    context_version: runtime.contextVersion,
    results,
  }
}
