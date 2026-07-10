import type { InternalLandCoverClass, LandCoverWarningCode } from '@/modules/territory/land-cover/land-cover.types'

export const LAND_COVER_WARNING_CODES: readonly LandCoverWarningCode[] = [
  'source_unavailable',
  'raster_hash_mismatch',
  'point_nodata',
  'point_outside_coverage',
  'incomplete_zone_coverage',
  'mixed_point_classes',
  'outdated_source_year',
  'invalid_geometry',
  'raster_processing_failed',
] as const

export interface LandCoverWarning {
  code: LandCoverWarningCode
  message: string
}

export function warning(
  code: LandCoverWarningCode,
  message: string,
): LandCoverWarning {
  return { code, message }
}

export function collectPointWarnings(input: {
  nodataCount: number
  outsideCount: number
  dominantClasses: Set<InternalLandCoverClass>
  referenceYear: number
  currentYear?: number
}): LandCoverWarning[] {
  const warnings: LandCoverWarning[] = []
  const year = input.currentYear ?? new Date().getFullYear()

  if (input.referenceYear < year) {
    warnings.push(
      warning(
        'outdated_source_year',
        `Fuente de cobertura ${input.referenceYear}; no representa el territorio en ${year}.`,
      ),
    )
  }
  if (input.nodataCount > 0) {
    warnings.push(
      warning(
        'point_nodata',
        `${input.nodataCount} punto(s) sin clase válida (nodata o fuera de cobertura).`,
      ),
    )
  }
  if (input.outsideCount > 0) {
    warnings.push(
      warning(
        'point_outside_coverage',
        `${input.outsideCount} punto(s) fuera del raster nacional recortado.`,
      ),
    )
  }
  const meaningful = [...input.dominantClasses].filter((c) => c !== 'unknown')
  if (meaningful.length > 1) {
    warnings.push(
      warning(
        'mixed_point_classes',
        `Detecciones con clases mixtas: ${meaningful.join(', ')}.`,
      ),
    )
  }
  return warnings
}

export function collectZoneWarnings(input: {
  dataCoveragePct: number
  thresholdPct?: number
}): LandCoverWarning[] {
  const threshold = input.thresholdPct ?? 95
  if (input.dataCoveragePct < threshold) {
    return [
      warning(
        'incomplete_zone_coverage',
        `Cobertura de datos ${input.dataCoveragePct.toFixed(1)}% (< ${threshold}%).`,
      ),
    ]
  }
  return []
}
