import {
  LAND_COVER_REFERENCE_YEAR,
  LAND_COVER_RESOLUTION_M,
  LAND_COVER_SOURCE_NAME,
  LAND_COVER_SOURCE_VERSION,
} from '@/modules/fires/config/land-cover.constants'
import type {
  LandCoverClassAreaDto,
  LandCoverClassCountDto,
  LandCoverContextDto,
  LandCoverContextStatus,
  LandCoverPointEvidenceDto,
  LandCoverZoneDto,
} from '@/modules/fires/types/fire.dto'
import {
  LAND_COVER_API_DISCLAIMER,
  landCoverDisplayLabel,
} from '@/modules/territory/land-cover/land-cover-taxonomy'
import type { LandCoverWarningCode } from '@/modules/territory/land-cover/land-cover.types'
import { LAND_COVER_WARNING_CODES } from '@/modules/territory/land-cover/land-cover-warnings'
import type { LandCoverContextRow, LandCoverZoneRow } from '@/pipeline/stores/land-cover.store'

interface StoredPointClassRow {
  internal_class?: string
  count?: number
  pct?: number
}

interface StoredZoneClassRow {
  internal_class?: string
  count?: number
  pct?: number
}

const WARNING_MESSAGES: Record<LandCoverWarningCode, string> = {
  source_unavailable: 'Fuente de cobertura del suelo no disponible.',
  raster_hash_mismatch: 'El producto raster no coincide con la versión esperada.',
  point_nodata: 'Algunas detecciones no tienen clase válida en el raster.',
  point_outside_coverage: 'Algunas detecciones quedan fuera del raster nacional.',
  incomplete_zone_coverage: 'Cobertura de datos incompleta en al menos una zona.',
  mixed_point_classes: 'Las detecciones presentan clases de cobertura mixtas.',
  outdated_source_year:
    'Producto de cobertura de referencia 2021; no representa la condición actual.',
  invalid_geometry: 'Geometría de análisis no válida para cobertura del suelo.',
  raster_processing_failed: 'Falló el procesamiento raster de cobertura del suelo.',
}

function parsePointDistribution(
  raw: Record<string, unknown>,
): LandCoverPointEvidenceDto {
  const classRows = (raw.class_distribution as StoredPointClassRow[] | undefined) ?? []
  const distribution: LandCoverClassCountDto[] = classRows
    .filter((row) => row.internal_class && (row.count ?? 0) > 0)
    .map((row) => {
      const cls = String(row.internal_class)
      const count = Number(row.count ?? 0)
      const pct = Number(row.pct ?? 0)
      return {
        class: cls,
        label: landCoverDisplayLabel(cls),
        count,
        percentage: Math.round(pct * 10) / 10,
      }
    })
    .sort((a, b) => b.count - a.count)

  const dominant = (raw.dominant_class as string | null | undefined) ?? null
  const meaningful = distribution.filter((row) => row.class !== 'unknown')
  const mixed = meaningful.length > 1

  const detections_sampled = distribution.reduce((sum, row) => sum + row.count, 0)

  return {
    detections_sampled,
    dominant_class: mixed ? null : dominant,
    mixed,
    class_distribution: distribution,
  }
}

function parseZoneDistribution(
  zone: LandCoverZoneRow,
): LandCoverClassAreaDto[] {
  const raw = zone.class_distribution as {
    classes?: StoredZoneClassRow[]
  }
  const rows = raw.classes ?? []
  const analyzedHa = zone.analyzed_area_ha != null ? Number(zone.analyzed_area_ha) : null

  return rows
    .filter((row) => row.internal_class && (row.pct ?? 0) > 0)
    .map((row) => {
      const cls = String(row.internal_class)
      const pct = Math.round(Number(row.pct ?? 0) * 10) / 10
      const area_ha =
        analyzedHa != null ? Math.round(((pct / 100) * analyzedHa) * 10) / 10 : null
      return {
        class: cls,
        label: landCoverDisplayLabel(cls),
        percentage: pct,
        area_ha,
      }
    })
    .filter((row) => row.percentage > 0)
    .sort((a, b) => b.percentage - a.percentage)
}

function mapWarnings(codes: unknown): string[] {
  if (!Array.isArray(codes)) return []
  return codes
    .filter((code): code is LandCoverWarningCode =>
      (LAND_COVER_WARNING_CODES as readonly string[]).includes(String(code)),
    )
    .map((code) => WARNING_MESSAGES[code])
}

function mapZoneRow(zone: LandCoverZoneRow): LandCoverZoneDto {
  const dominant = zone.dominant_class
  return {
    radius_m: zone.radius_m,
    dominant_class: dominant,
    dominant_label: landCoverDisplayLabel(dominant),
    class_distribution: parseZoneDistribution(zone),
    valid_pixel_count: zone.valid_pixel_count,
    data_coverage_pct:
      zone.data_coverage_pct != null ? Number(zone.data_coverage_pct) : null,
    analyzed_area_ha:
      zone.analyzed_area_ha != null ? Number(zone.analyzed_area_ha) : null,
  }
}

export function buildLandCoverContextDto(
  context: LandCoverContextRow | null,
  zones: LandCoverZoneRow[],
): LandCoverContextDto | null {
  if (!context) return null

  const pointRaw = context.point_distribution as Record<string, unknown>
  const point_evidence = parsePointDistribution(pointRaw)

  if (context.warnings.includes('mixed_point_classes')) {
    point_evidence.mixed = true
    point_evidence.dominant_class = null
  }

  const sortedZones = [...zones]
    .filter((z) => z.context_version === context.context_version)
    .sort((a, b) => a.radius_m - b.radius_m)
    .map(mapZoneRow)

  const status = context.status as LandCoverContextStatus

  return {
    status,
    source: {
      name: LAND_COVER_SOURCE_NAME,
      version: LAND_COVER_SOURCE_VERSION,
      year: context.reference_year ?? LAND_COVER_REFERENCE_YEAR,
      resolution_m: LAND_COVER_RESOLUTION_M,
    },
    generated_at: context.generated_at,
    context_version: context.context_version,
    point_evidence,
    zones: sortedZones,
    warnings: mapWarnings(context.warnings),
    disclaimer: LAND_COVER_API_DISCLAIMER,
  }
}

/** Campos internos que no deben aparecer en respuestas públicas. */
export const LAND_COVER_SENSITIVE_KEYS = [
  'source_layer_id',
  'samples',
  'provider_class_code',
  'internal_class',
  'latitude',
  'longitude',
  'raster',
  'cog',
  'gdal',
  'sha256',
  'geometry',
  'event_geometry',
] as const

export function assertLandCoverDtoSafe(dto: LandCoverContextDto): void {
  const json = JSON.stringify(dto).toLowerCase()
  for (const key of LAND_COVER_SENSITIVE_KEYS) {
    if (json.includes(key)) {
      throw new Error(`Land cover DTO exposes sensitive key: ${key}`)
    }
  }
}
