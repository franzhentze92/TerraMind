import {
  FIRE_STALE_AFTER_MINUTES,
  FIRE_SUMMARY_WINDOW_HOURS,
} from '@/modules/fires/config/fire.constants'
import {
  buildFireDataStatus,
  countSourcesWithDetections,
  parseIngestionRunStatus,
} from '@/modules/fires/api/fire-ingestion-status'
import { computeStaleStatus, computeWindowBounds } from '@/modules/fires/api/fire-api.validation'
import { mapEventRowToDto } from '@/modules/fires/api/fire-api.mappers'
import type { FireSummaryDto } from '@/modules/fires/types/fire.dto'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

const EVENT_SELECT = `
  id,
  status,
  validation_status,
  risk_level,
  priority_score,
  centroid_lat,
  centroid_lng,
  first_detected_at,
  last_detected_at,
  persistence_hours,
  detection_count,
  satellite_count,
  source_products,
  max_frp_mw,
  geometry_method,
  created_at,
  department_id,
  metadata,
  geo_departments!fire_events_department_id_fkey (code, name)
`

interface IngestionRow {
  started_at: string
  completed_at: string | null
  status: string
  sources_queried: string[] | null
  http_status: Record<string, number> | null
  rows_received: number | null
  metadata?: { sources?: Array<{ source: string; httpStatus: number; error?: string }> } | null
}

export async function getFireSummary(
  windowHours: number = FIRE_SUMMARY_WINDOW_HOURS,
): Promise<FireSummaryDto> {
  const supabase = getSupabaseAdmin()
  const generatedAt = new Date()
  const { window_start_utc, window_end_utc } = computeWindowBounds(windowHours, generatedAt)

  const [
    detectionsResult,
    outsideResult,
    eventsResult,
    ingestionResult,
    latestAcquisitionResult,
    sourcesResult,
  ] = await Promise.all([
    supabase
      .from('fire_detections')
      .select('id', { count: 'exact', head: true })
      .eq('is_inside_guatemala', true)
      .gte('acquired_at_utc', window_start_utc)
      .lte('acquired_at_utc', window_end_utc),

    supabase
      .from('fire_detections')
      .select('id', { count: 'exact', head: true })
      .eq('is_inside_guatemala', false),

    supabase
      .from('fire_events')
      .select(EVENT_SELECT)
      .gte('last_detected_at', window_start_utc)
      .lte('last_detected_at', window_end_utc)
      .order('priority_score', { ascending: false })
      .order('last_detected_at', { ascending: false })
      .order('id', { ascending: true }),

    supabase
      .from('fire_ingestion_runs')
      .select('started_at, completed_at, status, sources_queried, http_status, rows_received, metadata')
      .order('started_at', { ascending: false })
      .limit(5),

    supabase
      .from('fire_detections')
      .select('acquired_at_utc')
      .eq('is_inside_guatemala', true)
      .order('acquired_at_utc', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('fire_detections')
      .select('source_product')
      .eq('is_inside_guatemala', true)
      .gte('acquired_at_utc', window_start_utc)
      .lte('acquired_at_utc', window_end_utc),
  ])

  if (detectionsResult.error) throw new Error(detectionsResult.error.message)
  if (outsideResult.error) throw new Error(outsideResult.error.message)
  if (eventsResult.error) throw new Error(eventsResult.error.message)
  if (ingestionResult.error) throw new Error(ingestionResult.error.message)
  if (latestAcquisitionResult.error) throw new Error(latestAcquisitionResult.error.message)
  if (sourcesResult.error) throw new Error(sourcesResult.error.message)

  const events = (eventsResult.data ?? []).map(mapEventRowToDto)
  const departmentCodes = new Set(
    events.map((e) => e.department_code).filter((c): c is string => Boolean(c)),
  )
  const highest = events[0] ?? null

  const ingestionRows = (ingestionResult.data ?? []) as IngestionRow[]
  const lastIngestion = ingestionRows[0] ?? null
  const lastSuccessful = ingestionRows.find(
    (r) => r.status === 'success' || r.status === 'partial',
  )
  const ingestionBase = lastSuccessful ?? lastIngestion
  const parsedIngestion = parseIngestionRunStatus(
    ingestionBase ?? {
      status: 'failed',
      sources_queried: [],
      http_status: {},
      rows_received: 0,
    },
  )

  const sourceProductsInWindow = (sourcesResult.data ?? []).map(
    (r) => r.source_product as string,
  )
  const sourcesWithDetections = countSourcesWithDetections(sourceProductsInWindow)

  const lastSuccessfulAt = lastSuccessful?.completed_at ?? lastSuccessful?.started_at ?? null

  const dataStatus = buildFireDataStatus({
    lastFirmsIngestionAt: lastIngestion?.started_at ?? null,
    lastSuccessfulIngestionAt: lastSuccessfulAt,
    latestSatelliteAcquisitionAt: latestAcquisitionResult.data?.acquired_at_utc ?? null,
    sourcesWithDetections,
    ingestion: parsedIngestion,
    isStale: computeStaleStatus(lastSuccessfulAt, FIRE_STALE_AFTER_MINUTES, generatedAt),
    staleAfterMinutes: FIRE_STALE_AFTER_MINUTES,
  })

  return {
    window_hours: windowHours,
    window_start_utc,
    window_end_utc,
    observations_downloaded: parsedIngestion.observations_downloaded,
    detections_count: detectionsResult.count ?? 0,
    detections_outside_count: outsideResult.count ?? 0,
    events_count: events.length,
    active_events_count: events.filter((e) => e.status === 'active').length,
    monitoring_events_count: events.filter((e) => e.status === 'monitoring').length,
    attention_events_count: events.filter((e) => e.risk_level === 'atencion').length,
    probable_events_count: events.filter((e) => e.validation_status === 'probable').length,
    multisatellite_events_count: events.filter((e) => e.satellite_count >= 2).length,
    confirmed_events_count: events.filter((e) => e.validation_status === 'confirmado').length,
    departments_affected_count: departmentCodes.size,
    highest_priority_event: highest
      ? {
          id: highest.id,
          department: highest.department_name,
          risk_level: highest.risk_level,
          priority_score: highest.priority_score,
          detection_count: highest.detection_count,
          satellite_count: highest.satellite_count,
          last_detected_at: highest.last_detected_at,
        }
      : null,
    data_status: dataStatus,
    generated_at: generatedAt.toISOString(),
  }
}
