import type {
  PopulationDataQuality,
  PopulationSemantics,
  PopulationWarningCode,
} from './population.types'

export interface BuildPopulationDataQualityInput {
  source: string
  referenceYear: number
  officialOrModelled: PopulationSemantics
  spatialResolutionM: number
  populationType?: PopulationDataQuality['populationType']
  dataCoveragePct: number
  administrativeReconciliationStatus?: PopulationDataQuality['administrativeReconciliationStatus']
  adjustmentApplied?: boolean
  extraWarnings?: PopulationWarningCode[]
}

export function buildPopulationDataQuality(
  input: BuildPopulationDataQualityInput,
): PopulationDataQuality {
  const warnings: PopulationWarningCode[] = [...(input.extraWarnings ?? [])]
  const currentYear = new Date().getFullYear()

  if (input.referenceYear < currentYear - 2) {
    warnings.push('outdated_reference_year')
  }
  if (input.dataCoveragePct < 95) {
    warnings.push('incomplete_coverage')
  }
  const reconciliationStatus =
    input.administrativeReconciliationStatus ??
    (input.officialOrModelled === 'official_administrative_population'
      ? 'not_applicable'
      : 'pending')

  if (
    input.officialOrModelled === 'modelled_spatial_population' &&
    reconciliationStatus === 'pending'
  ) {
    warnings.push('adjustment_not_applied')
  }
  if (reconciliationStatus === 'mismatch') {
    warnings.push('official_total_mismatch')
  }

  return {
    source: input.source,
    referenceYear: input.referenceYear,
    officialOrModelled: input.officialOrModelled,
    spatialResolutionM: input.spatialResolutionM,
    populationType: input.populationType ?? 'resident',
    dataCoveragePct: input.dataCoveragePct,
    administrativeReconciliationStatus: reconciliationStatus,
    adjustmentApplied: input.adjustmentApplied ?? false,
    warnings: [...new Set(warnings)],
  }
}
