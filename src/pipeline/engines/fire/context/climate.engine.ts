import { buildClimateContextVersion } from '@/modules/climate/climate-context-version'
import {
  CLIMATE_EVENT_CONFIG,
  CLIMATE_EVENT_VARIABLES,
} from '@/modules/climate/config/climate-event.config'
import { analyzeClimateForEventPoints } from '@/modules/climate/services/climate-event-query.service'
import {
  centroidFallbackPoint,
  selectRepresentativeClimatePoints,
} from '@/modules/climate/services/climate-event-point-selection'
import {
  fetchClimateEventDetections,
  listClimateEventCandidates,
  persistClimateContext,
  type ClimateContextStatus,
  type ClimateEventCandidate,
} from '@/pipeline/stores/climate.store'

export class ClimateSourceUnavailableError extends Error {
  constructor(message = 'Proveedor climático no disponible') {
    super(message)
    this.name = 'ClimateSourceUnavailableError'
  }
}

export interface ClimateRuntimeContext {
  contextVersion: string
}

export interface ClimateEnrichResultRow {
  event_id: string
  department_name: string | null
  status: ClimateContextStatus
  point_count: number
  warnings: string[]
  duration_ms: number
  geometry_source: 'detections_sample' | 'event_centroid_fallback'
}

export function eventNeedsClimateEnrichment(
  event: ClimateEventCandidate,
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

export function resolveClimateRuntime(): ClimateRuntimeContext {
  const contextVersion = buildClimateContextVersion({
    provider: CLIMATE_EVENT_CONFIG.provider,
    model: CLIMATE_EVENT_CONFIG.model,
    variables: [...CLIMATE_EVENT_VARIABLES],
    eventTimeMatchingMethod: 'closest_hourly',
    representativePoints: CLIMATE_EVENT_CONFIG.maxRepresentativePoints,
    temporalToleranceMinutes: CLIMATE_EVENT_CONFIG.maxTimeOffsetMinutes,
    dryDayThresholdMm: CLIMATE_EVENT_CONFIG.dryDayThresholdMm,
    accumulationWindows: '24h,7d,30d',
    forecastWindows: '24h,72h',
    timezone: CLIMATE_EVENT_CONFIG.timezone,
    aggregationMethod: 'multi_point_min_max_mean',
  })
  return { contextVersion }
}

export async function enrichClimateForEvent(
  eventId: string,
  runtime?: ClimateRuntimeContext,
): Promise<ClimateEnrichResultRow> {
  const started = Date.now()
  const ctx = runtime ?? resolveClimateRuntime()
  const candidates = await listClimateEventCandidates(10000)
  const event = candidates.find((c) => c.id === eventId)
  if (!event) throw new Error('Evento no encontrado')

  const detections = await fetchClimateEventDetections(eventId)
  let geometrySource: 'detections_sample' | 'event_centroid_fallback' = 'detections_sample'
  let points = selectRepresentativeClimatePoints(
    detections.map((d) => ({
      id: d.id,
      lat: d.latitude,
      lon: d.longitude,
      acquired_at_utc: d.acquired_at_utc,
    })),
    CLIMATE_EVENT_CONFIG.maxRepresentativePoints,
  )

  if (points.length === 0) {
    if (event.centroid_lat == null || event.centroid_lng == null) {
      throw new Error('Evento sin detecciones ni centroide utilizable')
    }
    geometrySource = 'event_centroid_fallback'
    points = [
      centroidFallbackPoint(
        event.centroid_lat,
        event.centroid_lng,
        event.first_detected_at ?? event.last_detected_at ?? new Date().toISOString(),
      ),
    ]
  }

  const analysis = await analyzeClimateForEventPoints(points)
  const generatedAt = new Date().toISOString()

  let status: ClimateContextStatus = 'complete'
  if (analysis.warnings.length > 0) status = 'partial'
  if (analysis.warnings.includes('temporal_match_outside_tolerance')) status = 'partial'
  if (analysis.pointAnalyses.length === 0) status = 'unavailable'
  if (
    !analysis.forecastSummary.available &&
    (event.status === 'active' || event.status === 'monitoring' || event.status === 'new')
  ) {
    status = 'partial'
  }

  await persistClimateContext({
    entityType: 'fire_event',
    entityId: eventId,
    contextVersion: ctx.contextVersion,
    status,
    provider: CLIMATE_EVENT_CONFIG.provider,
    modelName: CLIMATE_EVENT_CONFIG.model,
    generatedAt,
    eventTimeStart: analysis.eventTimeStart,
    eventTimeEnd: analysis.eventTimeEnd,
    geometrySource,
    pointCount: analysis.pointAnalyses.length,
    temporalAlignment: analysis.temporalAlignment,
    conditionsSummary: analysis.conditionsSummary as unknown as Record<string, unknown>,
    antecedentSummary: analysis.antecedentSummary as unknown as Record<string, unknown>,
    forecastSummary: analysis.forecastSummary as unknown as Record<string, unknown>,
    sourceMetadata: {
      metrics: analysis.metrics,
      timezone: CLIMATE_EVENT_CONFIG.timezone,
      data_type: 'modelled_weather',
      spatial_variability: analysis.spatialVariability,
    },
    warnings: analysis.warnings,
    points: analysis.pointAnalyses.map((p) => ({
      role: p.point.role,
      lat: p.point.lat,
      lon: p.point.lon,
      eventTimestamp: p.point.acquired_at_utc,
      matchedWeatherTimestamp: p.matchedTimestamp,
      temporalOffsetMinutes: p.temporalOffsetMinutes,
      conditions: {
        ...p.conditions,
        antecedent: p.antecedent,
        forecast: p.forecast,
        warnings: p.warnings,
      },
    })),
  })

  return {
    event_id: eventId,
    department_name: event.department_name,
    status,
    point_count: analysis.pointAnalyses.length,
    warnings: analysis.warnings,
    duration_ms: Date.now() - started,
    geometry_source: geometrySource,
  }
}

export async function runClimateEnrichment(input: {
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
  results: ClimateEnrichResultRow[]
}> {
  const started = Date.now()
  const runtime = resolveClimateRuntime()
  let candidates = await listClimateEventCandidates(input.limit ?? 10000)
  if (input.eventId) candidates = candidates.filter((c) => c.id === input.eventId)

  const toProcess = candidates.filter((e) =>
    eventNeedsClimateEnrichment(e, runtime.contextVersion, input.force ?? false),
  )

  const results: ClimateEnrichResultRow[] = []
  let events_failed = 0

  for (const event of toProcess) {
    try {
      results.push(await enrichClimateForEvent(event.id, runtime))
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
