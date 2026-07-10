import type { PopulationWarning, PopulationWarningCode } from './population.types'

export const POPULATION_WARNING_CODES: readonly PopulationWarningCode[] = [
  'source_unavailable',
  'outdated_reference_year',
  'incomplete_coverage',
  'nodata_inside_geometry',
  'official_total_mismatch',
  'missing_admin_code',
  'settlement_source_unavailable',
  'adjustment_not_applied',
  'raster_processing_failed',
  'geometry_outside_coverage',
] as const

export function populationWarning(
  code: PopulationWarningCode,
  message: string,
): PopulationWarning {
  return { code, message }
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
