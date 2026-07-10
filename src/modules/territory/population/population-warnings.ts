import type {
  PopulationWarning,
  PopulationWarningCode,
  PopulationWarningSeverity,
} from './population.types'

export const POPULATION_WARNING_CODES: readonly PopulationWarningCode[] = [
  'source_unavailable',
  'outdated_reference_year',
  'incomplete_coverage',
  'partial_coverage',
  'nodata_inside_geometry',
  'official_total_mismatch',
  'missing_admin_code',
  'settlement_source_unavailable',
  'adjustment_not_applied',
  'raster_processing_failed',
  'geometry_outside_coverage',
  'fallback_to_wgs84',
  'checksum_invalid',
  'constrained_unconstrained_large_difference',
  'resolution_limit',
  'geometry_too_small',
  'geometry_too_large',
  'invalid_geometry',
  'transform_failed',
  'raster_read_failed',
] as const

const WARNING_SEVERITY: Partial<Record<PopulationWarningCode, PopulationWarningSeverity>> = {
  source_unavailable: 'error',
  raster_processing_failed: 'error',
  checksum_invalid: 'error',
  invalid_geometry: 'error',
  transform_failed: 'error',
  raster_read_failed: 'error',
  geometry_outside_coverage: 'warning',
  incomplete_coverage: 'warning',
  partial_coverage: 'warning',
  nodata_inside_geometry: 'warning',
  fallback_to_wgs84: 'warning',
  constrained_unconstrained_large_difference: 'warning',
  resolution_limit: 'info',
  geometry_too_small: 'info',
  geometry_too_large: 'warning',
  adjustment_not_applied: 'info',
  settlement_source_unavailable: 'info',
}

export function populationWarning(
  code: PopulationWarningCode,
  message: string,
  options?: { severity?: PopulationWarningSeverity; technicalDetails?: string },
): PopulationWarning {
  return {
    code,
    severity: options?.severity ?? WARNING_SEVERITY[code] ?? 'warning',
    message,
    ...(options?.technicalDetails ? { technicalDetails: options.technicalDetails } : {}),
  }
}

export function collectPopulationZoneWarnings(input: {
  dataCoveragePct: number
  nodataPixelCount: number
  referenceYear: number
  currentYear?: number
  thresholdPct?: number
}): PopulationWarning[] {
  const warnings: PopulationWarning[] = []
  const year = input.currentYear ?? new Date().getFullYear()
  const threshold = input.thresholdPct ?? 95

  if (input.referenceYear < year - 2) {
    warnings.push(
      populationWarning(
        'outdated_reference_year',
        `Año de referencia ${input.referenceYear}; puede no representar la población en ${year}.`,
      ),
    )
  }
  if (input.dataCoveragePct < threshold) {
    warnings.push(
      populationWarning(
        'incomplete_coverage',
        `Cobertura de datos ${input.dataCoveragePct.toFixed(1)}% (< ${threshold}%).`,
      ),
    )
  }
  if (input.nodataPixelCount > 0) {
    warnings.push(
      populationWarning(
        'nodata_inside_geometry',
        `${input.nodataPixelCount} píxel(es) sin población válida dentro de la geometría.`,
      ),
    )
  }
  return warnings
}

export function collectAdministrativeWarnings(input: {
  departmentCode?: string
  municipalityCode?: string
  officialPopulation?: number
  rasterSum?: number
  mismatchThresholdPct?: number
}): PopulationWarning[] {
  const warnings: PopulationWarning[] = []
  if (input.municipalityCode && !input.officialPopulation) {
    warnings.push(
      populationWarning(
        'missing_admin_code',
        `Sin cifra oficial para municipio ${input.municipalityCode}.`,
      ),
    )
  }
  if (
    input.officialPopulation !== undefined &&
    input.rasterSum !== undefined &&
    input.officialPopulation > 0
  ) {
    const threshold = input.mismatchThresholdPct ?? 15
    const diffPct =
      (Math.abs(input.rasterSum - input.officialPopulation) / input.officialPopulation) * 100
    if (diffPct > threshold) {
      warnings.push(
        populationWarning(
          'official_total_mismatch',
          `Suma raster (${Math.round(input.rasterSum)}) difiere ${diffPct.toFixed(1)}% del total oficial INE (${input.officialPopulation}).`,
        ),
      )
    }
  }
  return warnings
}

export function dedupeWarnings(warnings: PopulationWarning[]): PopulationWarning[] {
  const seen = new Set<string>()
  const out: PopulationWarning[] = []
  for (const w of warnings) {
    const key = `${w.code}|${w.message}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(w)
  }
  return out
}
