import {
  buildBiodiversityContextVersion,
  BIODIVERSITY_AGGREGATION_METHOD,
  BIODIVERSITY_DEDUP_VERSION,
  BIODIVERSITY_MEDIA_LICENSE_POLICY,
  BIODIVERSITY_PRIVACY_POLICY,
  BIODIVERSITY_SPATIAL_PRECISION_POLICY,
} from '@/modules/biodiversity/biodiversity-context-version'
import { BIODIVERSITY_EVENT_CONFIG } from '@/modules/biodiversity/config/biodiversity-event.config'
import { createFireBiodiversityAdapter } from '@/pipeline/adapters/fire-biodiversity.adapter'
import {
  fetchBiodiversityEventDetections,
  listBiodiversityEventCandidates,
  persistBiodiversityContext,
  type BiodiversityContextStatus,
  type BiodiversityEventCandidate,
} from '@/pipeline/stores/biodiversity-event.store'

export class BiodiversitySourceUnavailableError extends Error {
  constructor(message = 'Proveedores de biodiversidad no disponibles') {
    super(message)
    this.name = 'BiodiversitySourceUnavailableError'
  }
}

export interface BiodiversityRuntimeContext {
  contextVersion: string
}

export interface BiodiversityEnrichResultRow {
  event_id: string
  department_name: string | null
  status: BiodiversityContextStatus
  species_documented: number
  observations_documented: number
  warnings: string[]
  duration_ms: number
  geometry_source: 'detections_union' | 'event_centroid_fallback'
}

export function eventNeedsBiodiversityEnrichment(
  event: BiodiversityEventCandidate,
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

export function resolveBiodiversityRuntime(): BiodiversityRuntimeContext {
  const contextVersion = buildBiodiversityContextVersion({
    radiiM: [...BIODIVERSITY_EVENT_CONFIG.radiiM],
    historyYears: BIODIVERSITY_EVENT_CONFIG.historyYears,
    recentDays: BIODIVERSITY_EVENT_CONFIG.recentDays,
    eventWindowDays: BIODIVERSITY_EVENT_CONFIG.eventWindowDays,
    privacyPolicy: BIODIVERSITY_PRIVACY_POLICY,
    spatialPrecisionPolicy: BIODIVERSITY_SPATIAL_PRECISION_POLICY,
    deduplicationVersion: BIODIVERSITY_DEDUP_VERSION,
    mediaLicensePolicy: BIODIVERSITY_MEDIA_LICENSE_POLICY,
    aggregationMethod: BIODIVERSITY_AGGREGATION_METHOD,
  })
  return { contextVersion }
}

function resolveContextStatus(
  providerOkCount: number,
  observations: number,
  warnings: string[],
): BiodiversityContextStatus {
  if (providerOkCount === 0) return 'unavailable'
  if (observations === 0 && providerOkCount > 0) return 'partial'
  if (warnings.length > 0 || providerOkCount < 2) return 'partial'
  return 'complete'
}

export async function enrichBiodiversityForEvent(
  eventId: string,
  runtime?: BiodiversityRuntimeContext,
): Promise<BiodiversityEnrichResultRow> {
  const started = Date.now()
  const ctx = runtime ?? resolveBiodiversityRuntime()
  const candidates = await listBiodiversityEventCandidates(10000)
  const event = candidates.find((c) => c.id === eventId)
  if (!event) throw new Error('Evento no encontrado')

  const detections = await fetchBiodiversityEventDetections(eventId)
  const eventTime =
    event.first_detected_at ?? event.last_detected_at ?? new Date().toISOString()

  const adapter = createFireBiodiversityAdapter()
  const { analysis } = await adapter.enrichEntity({
    entityType: 'fire_event',
    entityId: eventId,
    detections,
    centroidLat: event.centroid_lat,
    centroidLng: event.centroid_lng,
    eventTime,
  })

  const providerOkCount = Object.values(analysis.providerStatus).filter((s) => s === 'ok').length
  if (providerOkCount === 0) {
    throw new BiodiversitySourceUnavailableError()
  }

  const status = resolveContextStatus(
    providerOkCount,
    analysis.summary.observations_documented,
    analysis.warnings,
  )
  const generatedAt = new Date().toISOString()

  await persistBiodiversityContext({
    entityType: 'fire_event',
    entityId: eventId,
    contextVersion: ctx.contextVersion,
    status,
    geometrySource: analysis.geometrySource,
    eventTime,
    historyStart: analysis.historyStart,
    historyEnd: analysis.historyEnd,
    providerStatus: analysis.providerStatus,
    summary: {
      ...analysis.summary,
      metrics: analysis.metrics,
    },
    quality: analysis.quality,
    monitoredZoneContext: {
      primary: analysis.monitoredZoneContext.primary,
      zones: analysis.monitoredZoneContext.zones,
    },
    warnings: analysis.warnings,
    generatedAt,
    zones: analysis.zones.map((z) => ({
      radius_m: z.radius_m,
      unique_species_documented: z.unique_species_documented,
      observations_documented: z.observations_documented,
      observations_recent_30d: z.observations_recent_30d,
      observations_recent_90d: z.observations_recent_90d,
      event_window_observations: z.event_window_observations,
      gbif_count: z.gbif_count,
      inaturalist_count: z.inaturalist_count,
      research_grade_inaturalist: z.research_grade_inaturalist,
      generalized_count: z.generalized_count,
      obscured_count: z.obscured_count,
      spatially_excluded_count: z.spatially_excluded_count,
      duplicated_count: z.duplicated_count,
      media_usable_count: z.media_usable_count,
      latest_observation_at: z.latest_observation_at,
      taxa_distribution: z.taxa_distribution,
      truncated: z.truncated,
      warnings: z.warnings,
      generatedAt,
    })),
    visualHighlights: analysis.visualHighlights,
  })

  return {
    event_id: eventId,
    department_name: event.department_name,
    status,
    species_documented: analysis.summary.unique_species_documented,
    observations_documented: analysis.summary.observations_documented,
    warnings: analysis.warnings,
    duration_ms: Date.now() - started,
    geometry_source: analysis.geometrySource,
  }
}

export async function runBiodiversityEnrichment(input: {
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
  results: BiodiversityEnrichResultRow[]
}> {
  const started = Date.now()
  const runtime = resolveBiodiversityRuntime()
  let candidates = await listBiodiversityEventCandidates(input.limit ?? 10000)
  if (input.eventId) candidates = candidates.filter((c) => c.id === input.eventId)

  const toProcess = candidates.filter((e) =>
    eventNeedsBiodiversityEnrichment(e, runtime.contextVersion, input.force ?? false),
  )

  const results: BiodiversityEnrichResultRow[] = []
  let events_failed = 0

  for (const event of toProcess) {
    try {
      results.push(await enrichBiodiversityForEvent(event.id, runtime))
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
