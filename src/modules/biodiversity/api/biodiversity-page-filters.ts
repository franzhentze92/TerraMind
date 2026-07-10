import type {
  BiodiversityDashboardFilters,
  BiodiversityPeriod,
  BiodiversityQualityFilter,
  BiodiversitySourceFilter,
  BiodiversityTaxonFilter,
  BiodiversityZoneFilter,
} from '@/modules/biodiversity/types/biodiversity-dashboard.types'

export const DEFAULT_BIODIVERSITY_FILTERS: BiodiversityDashboardFilters = {
  period: '5y',
  source: 'all',
  taxon: 'all',
  quality: 'all',
  zone: 'all',
}

const VALID_PERIODS: BiodiversityPeriod[] = ['30d', '90d', '1y', '5y']
const VALID_SOURCES: BiodiversitySourceFilter[] = ['all', 'gbif', 'inaturalist']
const VALID_TAXA: BiodiversityTaxonFilter[] = [
  'all',
  'birds',
  'plants',
  'mammals',
  'reptiles',
  'amphibians',
  'insects',
  'other',
]
const VALID_QUALITY: BiodiversityQualityFilter[] = [
  'all',
  'research',
  'with_coords',
  'generalized',
  'exclude_captive',
]
const VALID_ZONES: BiodiversityZoneFilter[] = [
  'all',
  'maya',
  'acatenango',
  'manchon',
  'sierra-minas',
  'atitlan',
]

function pickEnum<T extends string>(value: string | null, allowed: T[], fallback: T): T {
  if (!value) return fallback
  return (allowed.includes(value as T) ? value : fallback) as T
}

export function parseBiodiversityPageFilters(
  searchParams: URLSearchParams,
): BiodiversityDashboardFilters {
  return {
    period: pickEnum(searchParams.get('period'), VALID_PERIODS, '5y'),
    source: pickEnum(searchParams.get('source'), VALID_SOURCES, 'all'),
    taxon: pickEnum(searchParams.get('taxon'), VALID_TAXA, 'all'),
    quality: pickEnum(searchParams.get('quality'), VALID_QUALITY, 'all'),
    zone: pickEnum(searchParams.get('zone'), VALID_ZONES, 'all'),
  }
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

export function buildBiodiversidadPath(
  filters: BiodiversityDashboardFilters,
  zoneCode?: string | null,
): string {
  const next = zoneCode ? { ...filters, zone: zoneCode as BiodiversityZoneFilter } : filters
  const qs = filtersToQueryString(next)
  return qs ? `/biodiversidad?${qs}` : '/biodiversidad'
}

export function countActiveBiodiversityFilters(filters: BiodiversityDashboardFilters): number {
  let n = 0
  if (filters.period !== '5y') n++
  if (filters.source !== 'all') n++
  if (filters.taxon !== 'all') n++
  if (filters.quality !== 'all') n++
  if (filters.zone !== 'all') n++
  return n
}

export const PERIOD_LABELS: Record<BiodiversityPeriod, string> = {
  '30d': '30 días',
  '90d': '90 días',
  '1y': '1 año',
  '5y': '5 años',
}

export const TAXON_LABELS: Record<BiodiversityTaxonFilter, string> = {
  all: 'Todos los grupos',
  birds: 'Aves',
  plants: 'Plantas',
  mammals: 'Mamíferos',
  reptiles: 'Reptiles',
  amphibians: 'Anfibios',
  insects: 'Insectos',
  other: 'Otros',
}

export const SOURCE_LABELS: Record<BiodiversitySourceFilter, string> = {
  all: 'Todas las fuentes',
  gbif: 'GBIF',
  inaturalist: 'iNaturalist',
}

export const QUALITY_LABELS: Record<BiodiversityQualityFilter, string> = {
  all: 'Todas las calidades',
  research: 'Research grade',
  with_coords: 'Con coordenadas',
  generalized: 'Generalizadas',
  exclude_captive: 'Sin cautiverio',
}

export const COVERAGE_LABELS: Record<string, string> = {
  alta: 'Cobertura alta',
  media: 'Cobertura media',
  limitada: 'Cobertura limitada',
  parcial: 'Resultado parcial',
}

export const DATA_STATUS_LABELS: Record<string, string> = {
  success: 'Datos actualizados',
  partial: 'Datos parciales',
  providers_unavailable: 'Fuentes no disponibles',
  stale: 'Datos en caché',
  truncated: 'Muestra truncada',
  no_recent_observations: 'Sin observaciones recientes',
}
