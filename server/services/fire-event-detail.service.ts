import { FIRE_AREA_DISCLAIMER } from '@/modules/fires/config/fire.constants'
import {
  buildEventInterpretation,
  buildEvidenceSummary,
} from '@/modules/fires/utils/fire-interpretation'
import { mapEventRowToDto } from '@/modules/fires/api/fire-api.mappers'
import type { FireEventDetailDto, FireDepartmentOptionDto } from '@/modules/fires/types/fire.dto'
import { buildProtectedAreaContextDto } from '@/modules/fires/utils/protected-area-context.dto'
import { buildLandCoverContextDto } from '@/modules/fires/utils/land-cover-context.dto'
import { buildLandCoverEnrichmentState } from '@/modules/fires/utils/land-cover-enrichment-state'
import type { FireEventContextRow } from '@/pipeline/stores/territorial.store'
import {
  getLandCoverContext,
  getLandCoverZones,
} from '@/pipeline/stores/land-cover.store'
import { getActiveLandCoverJobForEvent } from '@/pipeline/stores/land-cover-jobs.store'
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
  estimated_area_ha,
  created_at,
  department_id,
  metadata,
  geo_departments!fire_events_department_id_fkey (code, name)
`

const DETECTION_SELECT = `
  id,
  latitude,
  longitude,
  acquired_at_utc,
  source_product,
  satellite,
  instrument,
  confidence_normalized,
  frp_mw,
  brightness,
  daynight
`

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export async function getFireEventDetail(eventId: string): Promise<FireEventDetailDto | null> {
  const supabase = getSupabaseAdmin()
  const generatedAt = new Date().toISOString()

  const { data: eventRow, error: eventError } = await supabase
    .from('fire_events')
    .select(EVENT_SELECT)
    .eq('id', eventId)
    .maybeSingle()

  if (eventError) throw new Error(eventError.message)
  if (!eventRow) return null

  const { data: links, error: linksError } = await supabase
    .from('fire_event_detections')
    .select(`detection_id, fire_detections (${DETECTION_SELECT})`)
    .eq('event_id', eventId)
    .order('linked_at', { ascending: true })

  if (linksError) throw new Error(linksError.message)

  const { data: contextRow, error: contextError } = await supabase
    .from('fire_event_context')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle()

  if (contextError) throw new Error(contextError.message)

  const base = mapEventRowToDto(eventRow)
  const detections = (links ?? [])
    .map((link) => {
      const raw = link.fire_detections as Record<string, unknown> | Record<string, unknown>[] | null
      const det = Array.isArray(raw) ? raw[0] : raw
      if (!det) return null
      return {
        id: String(det.id),
        latitude: toNumber(det.latitude as number) ?? 0,
        longitude: toNumber(det.longitude as number) ?? 0,
        acquired_at_utc: String(det.acquired_at_utc),
        source_product: String(det.source_product),
        satellite: (det.satellite as string | null) ?? null,
        instrument: (det.instrument as string | null) ?? null,
        confidence_normalized:
          (det.confidence_normalized as 'baja' | 'media' | 'alta' | null) ?? null,
        frp_mw: toNumber(det.frp_mw as number | string | null),
        brightness: toNumber(det.brightness as number | string | null),
        daynight: (det.daynight as string | null) ?? null,
      }
    })
    .filter((d): d is NonNullable<typeof d> => d !== null)
    .sort((a, b) => a.acquired_at_utc.localeCompare(b.acquired_at_utc))

  const protected_area_context = await buildProtectedAreaContextDto(
    contextRow as FireEventContextRow | null,
  )

  const landCoverRow = await getLandCoverContext(eventId)
  const landCoverZones = landCoverRow
    ? await getLandCoverZones(eventId, landCoverRow.context_version)
    : []
  const land_cover_context = buildLandCoverContextDto(landCoverRow, landCoverZones)
  const activeLandCoverJob = land_cover_context
    ? null
    : await getActiveLandCoverJobForEvent(eventId)
  const land_cover_enrichment = buildLandCoverEnrichmentState(
    land_cover_context,
    activeLandCoverJob,
  )

  const detail: FireEventDetailDto = {
    ...base,
    estimated_area_ha: toNumber(eventRow.estimated_area_ha as number | string | null),
    area_disclaimer: FIRE_AREA_DISCLAIMER,
    detections,
    evidence_summary: buildEvidenceSummary({ ...base, max_frp_mw: base.max_frp_mw }),
    interpretation: buildEventInterpretation({
      detection_count: base.detection_count,
      satellite_count: base.satellite_count,
      validation_status: base.validation_status,
      risk_level: base.risk_level,
      persistence_hours: base.persistence_hours,
      multisatellite: base.satellite_count >= 2,
    }),
    protected_area_context,
    land_cover_context,
    land_cover_enrichment,
    generated_at: generatedAt,
  }

  return detail
}

export async function listFireDepartments(): Promise<FireDepartmentOptionDto[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('geo_departments')
    .select('code, name')
    .eq('country_code', 'GT')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((d) => ({ code: d.code, name: d.name }))
}
