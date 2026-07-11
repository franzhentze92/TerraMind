import type {
  BiodiversityContextDto,
  ClimateContextDto,
  LandCoverContextDto,
  PopulationContextDto,
  ProtectedAreaContextDto,
} from '@/modules/fires/types/fire.dto'
import { buildBiodiversityContextDto } from '@/modules/fires/utils/biodiversity-context.dto'
import { buildClimateContextDto } from '@/modules/fires/utils/climate-context.dto'
import { buildLandCoverContextDto } from '@/modules/fires/utils/land-cover-context.dto'
import { buildPopulationContextDto } from '@/modules/fires/utils/population-context.dto'
import { buildProtectedAreaContextDto } from '@/modules/fires/utils/protected-area-context.dto'
import { getLatestBiodiversityContext, getBiodiversityZones, getBiodiversityVisualHighlights } from '@/pipeline/stores/biodiversity-event.store'
import { getLatestClimateContext } from '@/pipeline/stores/climate.store'
import { getLandCoverContext, getLandCoverZones } from '@/pipeline/stores/land-cover.store'
import { getLatestPopulationContext, getPopulationZones } from '@/pipeline/stores/population.store'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'
import type { FireEventContextRow } from '@/pipeline/stores/territorial.store'
import {
  buildFindingsContextVersion,
  buildFireEventSignature,
  defaultRuleSetVersion,
} from '../findings-context-version'

export type ContextAvailability = 'complete' | 'partial' | 'unavailable' | 'missing'

export interface FireFindingEvaluationContext {
  event: {
    id: string
    department_code: string | null
    department_name: string | null
    status: string
    validation_status: string
    detection_count: number
    first_detected_at: string
    last_detected_at: string
    centroid_lat: number | null
    centroid_lng: number | null
  }
  protected_area: ProtectedAreaContextDto | null
  land_cover: LandCoverContextDto | null
  population: PopulationContextDto | null
  climate: ClimateContextDto | null
  biodiversity: BiodiversityContextDto | null
  availability: {
    protected_area: ContextAvailability
    land_cover: ContextAvailability
    population: ContextAvailability
    climate: ContextAvailability
    biodiversity: ContextAvailability
  }
  context_versions: {
    fire_event: string
    protected_area: string | null
    land_cover: string | null
    population: string | null
    climate: string | null
    biodiversity: string | null
    composite: string
    rule_set: string
  }
}

function mapAvailability(
  ctx: { status?: string } | null | undefined,
  required = false,
): ContextAvailability {
  if (!ctx) return required ? 'missing' : 'missing'
  const status = ctx.status
  if (status === 'complete') return 'complete'
  if (status === 'partial' || status === 'stale') return 'partial'
  if (status === 'unavailable' || status === 'error') return 'unavailable'
  return required ? 'missing' : 'missing'
}

export async function loadFireFindingEvaluationContext(
  eventId: string,
): Promise<FireFindingEvaluationContext | null> {
  const supabase = getSupabaseAdmin()

  const { data: eventRow, error: eventError } = await supabase
    .from('fire_events')
    .select(
      `
      id, status, validation_status, detection_count,
      centroid_lat, centroid_lng, first_detected_at, last_detected_at,
      geo_departments!fire_events_department_id_fkey (code, name)
    `,
    )
    .eq('id', eventId)
    .maybeSingle()

  if (eventError) throw new Error(eventError.message)
  if (!eventRow) return null

  const deptRaw = eventRow.geo_departments as { code?: string; name?: string } | { code?: string; name?: string }[] | null
  const dept = Array.isArray(deptRaw) ? deptRaw[0] : deptRaw

  const { data: contextRow } = await supabase
    .from('fire_event_context')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle()

  const protected_area = await buildProtectedAreaContextDto(
    contextRow as FireEventContextRow | null,
  )

  const landCoverRow = await getLandCoverContext(eventId)
  const landCoverZones = landCoverRow
    ? await getLandCoverZones(eventId, landCoverRow.context_version)
    : []
  const land_cover = buildLandCoverContextDto(landCoverRow, landCoverZones)

  const populationRow = await getLatestPopulationContext(eventId)
  const populationZones = populationRow ? await getPopulationZones(populationRow.id) : []
  const population = buildPopulationContextDto(populationRow, populationZones)

  const climateRow = await getLatestClimateContext(eventId)
  const climate = buildClimateContextDto(climateRow)

  const biodiversityRow = await getLatestBiodiversityContext(eventId)
  const biodiversityZones = biodiversityRow ? await getBiodiversityZones(biodiversityRow.id) : []
  const biodiversityHighlights = biodiversityRow
    ? await getBiodiversityVisualHighlights(biodiversityRow.id)
    : []
  const biodiversity = buildBiodiversityContextDto(
    biodiversityRow,
    biodiversityZones,
    biodiversityHighlights,
  )

  const fireEventSignature = buildFireEventSignature({
    detection_count: Number(eventRow.detection_count ?? 0),
    last_detected_at: eventRow.last_detected_at ? String(eventRow.last_detected_at) : null,
    validation_status: String(eventRow.validation_status ?? 'pending'),
  })

  const rule_set = defaultRuleSetVersion()
  const composite = buildFindingsContextVersion({
    ruleSetVersion: rule_set,
    fireEventSignature,
    protectedAreaVersion: protected_area?.source_version ?? protected_area?.generated_at ?? null,
    landCoverVersion: land_cover?.context_version ?? null,
    populationVersion: populationRow?.context_version ?? null,
    climateVersion: climateRow?.context_version ?? null,
    biodiversityVersion: biodiversityRow?.context_version ?? null,
  })

  return {
    event: {
      id: String(eventRow.id),
      department_code: dept?.code ?? null,
      department_name: dept?.name ?? null,
      status: String(eventRow.status ?? 'new'),
      validation_status: String(eventRow.validation_status ?? 'pending'),
      detection_count: Number(eventRow.detection_count ?? 0),
      first_detected_at: String(eventRow.first_detected_at ?? ''),
      last_detected_at: String(eventRow.last_detected_at ?? ''),
      centroid_lat: eventRow.centroid_lat != null ? Number(eventRow.centroid_lat) : null,
      centroid_lng: eventRow.centroid_lng != null ? Number(eventRow.centroid_lng) : null,
    },
    protected_area,
    land_cover,
    population,
    climate,
    biodiversity,
    availability: {
      protected_area: protected_area ? mapAvailability(protected_area, true) : 'missing',
      land_cover: land_cover ? mapAvailability(land_cover, true) : 'missing',
      population: population ? mapAvailability(population) : 'missing',
      climate: climate ? mapAvailability(climate) : 'missing',
      biodiversity: biodiversity ? mapAvailability(biodiversity) : 'missing',
    },
    context_versions: {
      fire_event: fireEventSignature,
      protected_area: protected_area?.source_version ?? null,
      land_cover: land_cover?.context_version ?? null,
      population: populationRow?.context_version ?? null,
      climate: climateRow?.context_version ?? null,
      biodiversity: biodiversityRow?.context_version ?? null,
      composite,
      rule_set,
    },
  }
}
