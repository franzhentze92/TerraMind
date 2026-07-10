import {
  POPULATION_FIRE_API_DISCLAIMER,
  POPULATION_FIRE_PRODUCT,
  POPULATION_FIRE_REFERENCE_YEAR,
  POPULATION_FIRE_RESOLUTION_M,
  POPULATION_FIRE_SOURCE_NAME,
} from '@/modules/fires/config/population.constants'
import type {
  PopulationContextDto,
  PopulationContextStatus,
  PopulationEnrichmentStateDto,
  PopulationOfficialContextDto,
  PopulationSettlementDto,
  PopulationZoneDto,
} from '@/modules/fires/types/fire.dto'
import type { PopulationWarningCode } from '@/modules/territory/population/population.types'
import type {
  PopulationContextRow,
  PopulationZoneRow,
} from '@/pipeline/stores/population.store'

const WARNING_MESSAGES: Partial<Record<PopulationWarningCode, string>> = {
  validation_source_unavailable: 'Modelo de validación no disponible.',
  official_context_unavailable: 'Contexto oficial INE no disponible.',
  municipality_official_data_unavailable: 'Dato oficial municipal no disponible.',
  settlement_source_unavailable: 'Fuente de asentamientos no disponible.',
  settlement_dataset_limited_to_municipal_seats:
    'Los asentamientos corresponden principalmente a cabeceras municipales.',
  centroid_fallback: 'Análisis basado en centroide del evento por ausencia de detecciones válidas.',
  large_model_difference:
    'Los modelos espaciales difieren significativamente para este territorio.',
  partial_coverage: 'Cobertura parcial en al menos un radio.',
  resolution_limit: 'Resolución espacial ~100 m.',
  outdated_reference_year: 'Año de referencia desactualizado.',
}

export function formatPopulationCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)} mil`
  return String(Math.round(value))
}

function mapWarnings(codes: unknown): string[] {
  if (!Array.isArray(codes)) return []
  return codes
    .map((code) => WARNING_MESSAGES[code as PopulationWarningCode] ?? String(code))
    .filter(Boolean)
}

function mapOfficialContext(raw: Record<string, unknown>): PopulationOfficialContextDto {
  const dept = raw.department as Record<string, unknown> | undefined
  return {
    department: dept
      ? {
          name: String(dept.adminName ?? ''),
          official_population: Number(dept.officialPopulation ?? 0),
          reference_year: Number(dept.referenceYear ?? POPULATION_FIRE_REFERENCE_YEAR),
          statistic_type: dept.projectionYear ? 'projection' : 'census',
          source: 'INE Guatemala',
        }
      : null,
    municipality: null,
    temporal_alignment:
      (raw.temporal_alignment as PopulationOfficialContextDto['temporal_alignment']) ?? 'partial',
  }
}

function mapSettlements(raw: unknown): PopulationSettlementDto[] {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 5).map((item) => {
    const row = item as Record<string, unknown>
    return {
      name: String(row.name ?? ''),
      type: String(row.type ?? 'municipal_seat'),
      distance_m: Number(row.distance_m ?? 0),
      source: String(row.source ?? 'HDX COD-AB'),
      department: row.department ? String(row.department) : undefined,
      municipality: row.municipality ? String(row.municipality) : undefined,
    }
  })
}

function mapZone(zone: PopulationZoneRow): PopulationZoneDto {
  return {
    radius_m: zone.radius_m,
    estimated_population: Number(zone.estimated_population),
    validation_estimate:
      zone.validation_estimate != null ? Number(zone.validation_estimate) : undefined,
    difference_pct: zone.difference_pct != null ? Number(zone.difference_pct) : undefined,
    density_per_km2:
      zone.population_density_per_km2 != null ? Number(zone.population_density_per_km2) : 0,
    data_coverage_pct: zone.data_coverage_pct != null ? Number(zone.data_coverage_pct) : 100,
    warnings: mapWarnings(zone.warnings),
  }
}

export function buildPopulationContextDto(
  context: PopulationContextRow | null,
  zones: PopulationZoneRow[],
  options?: { eventLastLinkedAt?: string | null },
): PopulationContextDto | null {
  if (!context) return null

  let status = context.status as PopulationContextStatus
  if (
    options?.eventLastLinkedAt &&
    context.generated_at &&
    options.eventLastLinkedAt > context.generated_at &&
    status === 'complete'
  ) {
    status = 'stale'
  }

  const official = mapOfficialContext(context.official_population_context ?? {})

  return {
    status,
    source: {
      name: POPULATION_FIRE_SOURCE_NAME,
      product: POPULATION_FIRE_PRODUCT,
      reference_year: context.reference_year ?? POPULATION_FIRE_REFERENCE_YEAR,
      resolution_m: POPULATION_FIRE_RESOLUTION_M,
      type: 'modelled_spatial_population',
    },
    generated_at: context.generated_at,
    context_version: context.context_version,
    geometry_source:
      (context.geometry_source as PopulationContextDto['geometry_source']) ?? 'detections',
    zones: zones.map(mapZone),
    official_context: official,
    nearest_settlements: mapSettlements(context.nearest_settlements),
    warnings: mapWarnings(context.warnings),
    disclaimer: POPULATION_FIRE_API_DISCLAIMER,
  }
}

export function buildPopulationEnrichmentState(
  context: PopulationContextDto | null,
  activeJob: { status: string } | null,
): PopulationEnrichmentStateDto | null {
  if (context) {
    return { status: 'complete', message: null }
  }
  if (!activeJob) {
    return {
      status: 'unavailable',
      message: 'Contexto poblacional aún no calculado.',
    }
  }
  if (activeJob.status === 'pending') {
    return { status: 'queued', message: 'Contexto poblacional en cola de procesamiento.' }
  }
  if (activeJob.status === 'processing') {
    return { status: 'processing', message: 'Contexto poblacional en procesamiento.' }
  }
  return { status: 'unavailable', message: 'Contexto poblacional aún no calculado.' }
}

export const POPULATION_SENSITIVE_KEYS = [
  'geom',
  'geometry',
  'raster',
  'cog',
  'gdal',
  'tif',
  'data/population',
] as const
