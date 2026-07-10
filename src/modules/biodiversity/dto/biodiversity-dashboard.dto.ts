import { z } from 'zod'
import { BIODIVERSITY_ZONE_CODES } from '../config/biodiversity-zones.config'
import type { BiodiversityProviderId } from '../biodiversity.types'

export const biodiversityPeriodSchema = z.enum(['30d', '90d', '1y', '5y'])
export const biodiversitySourceFilterSchema = z.enum(['all', 'gbif', 'inaturalist'])
export const biodiversityTaxonFilterSchema = z.enum([
  'all',
  'birds',
  'plants',
  'mammals',
  'reptiles',
  'amphibians',
  'insects',
  'other',
])
export const biodiversityQualityFilterSchema = z.enum([
  'all',
  'research',
  'with_coords',
  'generalized',
  'exclude_captive',
])
export const biodiversityZoneFilterSchema = z.enum(['all', ...BIODIVERSITY_ZONE_CODES] as [
  'all',
  ...string[],
])

export const biodiversityDashboardFiltersSchema = z.object({
  period: biodiversityPeriodSchema.default('5y'),
  source: biodiversitySourceFilterSchema.default('all'),
  taxon: biodiversityTaxonFilterSchema.default('all'),
  quality: biodiversityQualityFilterSchema.default('all'),
  zone: biodiversityZoneFilterSchema.default('all'),
})

export type BiodiversityPeriod = z.infer<typeof biodiversityPeriodSchema>
export type BiodiversitySourceFilter = z.infer<typeof biodiversitySourceFilterSchema>
export type BiodiversityTaxonFilter = z.infer<typeof biodiversityTaxonFilterSchema>
export type BiodiversityQualityFilter = z.infer<typeof biodiversityQualityFilterSchema>
export type BiodiversityZoneFilter = z.infer<typeof biodiversityZoneFilterSchema>
export type BiodiversityDashboardFilters = z.infer<typeof biodiversityDashboardFiltersSchema>

export type BiodiversityDashboardDataStatus =
  | 'success'
  | 'partial'
  | 'providers_unavailable'
  | 'stale'
  | 'truncated'
  | 'no_recent_observations'

export type BiodiversityZoneCoverageLabel = 'alta' | 'media' | 'limitada' | 'parcial'

export interface BiodiversityDashboardNationalSummary {
  species_count: number
  observations_count: number
  recent_30d_count: number
  zones_monitored: number
  sources_active: BiodiversityProviderId[]
  generalized_count: number
  period_label: string
  selected_period_observations_count: number
  truncated: boolean
  observations_at_least?: number
  narrative: string
  /** Texto compacto para tarjeta ejecutiva en Situación Nacional. */
  card_narrative: string
}

export interface BiodiversityDashboardQualitySummary {
  coordinate_completeness_pct: number
  coordinates_present_count: number
  inaturalist_research_grade: { count: number; total: number } | null
  obscured_count: number
  captive_count: number
  unknown_license_count: number
  possible_duplicate_count: number
  truncated: boolean
  notes: string[]
}

export interface BiodiversityDashboardTopZone {
  zone_code: string
  zone_name: string
  species_count: number
  observations_count: number
}

export interface BiodiversityDashboardZoneItem {
  zone_code: string
  zone_name: string
  region_label: string
  centroid: { lat: number; lng: number }
  radius_km: number
  species_count: number
  observations_count: number
  recent_count: number
  research_grade_pct: number | null
  generalized_count: number
  top_taxonomic_groups: string[]
  coverage_label: BiodiversityZoneCoverageLabel
  source_distribution: { gbif: number; inaturalist: number }
  data_status: BiodiversityDashboardDataStatus
  narrative: string
}

export interface BiodiversityDashboardActivityWeek {
  week_start: string
  label: string
  gbif: number
  inaturalist: number
  total: number
}

export interface BiodiversityDashboardActivity {
  by_week: BiodiversityDashboardActivityWeek[]
  selected_period_count: number
  recent_30d_count: number
  truncated: boolean
}

export interface BiodiversityDashboardSourceItem {
  provider: BiodiversityProviderId
  records: number
  reachable: boolean
  last_success: string | null
  status: 'ok' | 'unavailable' | 'no_data'
}

export interface BiodiversityDashboardSummaryDto {
  generated_at: string
  data_status: BiodiversityDashboardDataStatus
  national_summary: BiodiversityDashboardNationalSummary
  top_zone: BiodiversityDashboardTopZone | null
  zones: BiodiversityDashboardZoneItem[]
  taxonomic_distribution: Record<string, number>
  activity: BiodiversityDashboardActivity
  quality: BiodiversityDashboardQualitySummary
  sources: BiodiversityDashboardSourceItem[]
  disclaimer: string
  filters_applied: BiodiversityDashboardFilters
  is_cached?: boolean
}

export interface BiodiversityZoneDetailDto {
  generated_at: string
  zone_code: string
  zone_name: string
  region_label: string
  centroid: { lat: number; lng: number }
  radius_km: number
  data_status: BiodiversityDashboardDataStatus
  summary: {
    species_count: number
    observations_count: number
    recent_count: number
    research_grade_count: number
    generalized_count: number
    narrative: string
  }
  taxonomic_distribution: Record<string, number>
  activity: BiodiversityDashboardActivity
  quality: {
    coordinate_completeness_pct: number
    coordinates_present_count: number
    inaturalist_research_grade: { count: number; total: number } | null
    obscured_count: number
    captive_count: number
    unknown_license_count: number
    possible_duplicate_count: number
    truncated: boolean
    notes: string[]
  }
  sources: BiodiversityDashboardSourceItem[]
  disclaimer: string
  filters_applied: BiodiversityDashboardFilters
}

export interface BiodiversityZonesListDto {
  generated_at: string
  zones: Array<{
    zone_code: string
    zone_name: string
    region_label: string
    centroid: { lat: number; lng: number }
    radius_km: number
  }>
}

const PERIOD_DAYS: Record<BiodiversityPeriod, number> = {
  '30d': 30,
  '90d': 90,
  '1y': 365,
  '5y': 365 * 5,
}

export function periodToObservedFrom(period: BiodiversityPeriod, now = new Date()): string {
  const days = PERIOD_DAYS[period]
  const d = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

export function parseBiodiversityDashboardFilters(
  searchParams: URLSearchParams,
): { ok: true; data: BiodiversityDashboardFilters } | { ok: false; error: string } {
  const raw = Object.fromEntries(searchParams.entries())
  const parsed = biodiversityDashboardFiltersSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') }
  }
  return { ok: true, data: parsed.data }
}

export function filtersToQueryString(filters: BiodiversityDashboardFilters): string {
  const params = new URLSearchParams()
  if (filters.period !== '5y') params.set('period', filters.period)
  if (filters.source !== 'all') params.set('source', filters.source)
  if (filters.taxon !== 'all') params.set('taxon', filters.taxon)
  if (filters.quality !== 'all') params.set('quality', filters.quality)
  if (filters.zone !== 'all') params.set('zone', filters.zone)
  return params.toString()
}
