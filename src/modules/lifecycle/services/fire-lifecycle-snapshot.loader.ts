import type { LifecycleEvaluationSnapshot } from '@/modules/lifecycle/lifecycle.types'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

export async function loadFireLifecycleSnapshot(
  eventId: string,
): Promise<LifecycleEvaluationSnapshot | null> {
  const supabase = getSupabaseAdmin()

  const { data: event, error: eventError } = await supabase
    .from('fire_events')
    .select(
      `
      id, validation_status, first_detected_at, last_detected_at,
      detection_count, persistence_hours, estimated_area_ha, max_frp_mw,
      lifecycle_state, inactive_since, monitoring_until, resolved_at,
      reactivated_at, last_confirmed_at
    `,
    )
    .eq('id', eventId)
    .maybeSingle()

  if (eventError) throw new Error(eventError.message)
  if (!event) return null

  const { data: links, error: linkError } = await supabase
    .from('fire_event_detections')
    .select(
      `
      detection_id,
      fire_detections!inner (
        id, acquired_at_utc, latitude, longitude, frp_mw, source_product
      )
    `,
    )
    .eq('event_id', eventId)

  if (linkError) throw new Error(linkError.message)

  const detections = (links ?? []).map((row) => {
    const detRaw = row.fire_detections as
      | {
          id: string
          acquired_at_utc: string
          latitude: number
          longitude: number
          frp_mw: number | null
          source_product: string | null
        }
      | Array<{
          id: string
          acquired_at_utc: string
          latitude: number
          longitude: number
          frp_mw: number | null
          source_product: string | null
        }>
    const det = Array.isArray(detRaw) ? detRaw[0] : detRaw
    return {
      id: String(det.id),
      acquired_at: String(det.acquired_at_utc),
      latitude: Number(det.latitude),
      longitude: Number(det.longitude),
      frp_mw: det.frp_mw != null ? Number(det.frp_mw) : null,
      source_product: det.source_product ?? null,
    }
  })

  const lastConfirmed =
    event.validation_status === 'confirmado' && event.last_confirmed_at
      ? String(event.last_confirmed_at)
      : event.validation_status === 'confirmado'
        ? null
        : null

  return {
    entity_type: 'fire_event',
    entity_id: String(event.id),
    lifecycle_state: (event.lifecycle_state as LifecycleEvaluationSnapshot['lifecycle_state']) ?? 'detected',
    validation_status: String(event.validation_status ?? 'no_validado'),
    first_detected_at: String(event.first_detected_at),
    last_detected_at: String(event.last_detected_at),
    detection_count: Number(event.detection_count ?? 0),
    persistence_hours: event.persistence_hours != null ? Number(event.persistence_hours) : null,
    estimated_area_ha: event.estimated_area_ha != null ? Number(event.estimated_area_ha) : null,
    max_frp_mw: event.max_frp_mw != null ? Number(event.max_frp_mw) : null,
    inactive_since: event.inactive_since ? String(event.inactive_since) : null,
    monitoring_until: event.monitoring_until ? String(event.monitoring_until) : null,
    resolved_at: event.resolved_at ? String(event.resolved_at) : null,
    reactivated_at: event.reactivated_at ? String(event.reactivated_at) : null,
    last_confirmed_at: lastConfirmed,
    detections,
  }
}

export async function listFireEventCandidatesForLifecycle(limit = 10000): Promise<
  Array<{ id: string }>
> {
  const { listFireEventCandidatesForFindings } = await import(
    '@/pipeline/engines/findings/finding-evaluation.engine'
  )
  const rows = await listFireEventCandidatesForFindings(limit)
  return rows.map((r) => ({ id: r.id }))
}
