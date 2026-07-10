/**
 * Modelo de confianza para estimaciones constrained vs unconstrained (7D.3.1).
 * No altera rasters; solo interpreta divergencia entre modelos.
 */

export type PopulationConfidenceLevel = 'high' | 'moderate' | 'low' | 'very_low'

export type PopulationAgreementClass =
  | 'close'
  | 'moderate_difference'
  | 'large_difference'
  | 'extreme_difference'

export type PopulationRecommendedDisplayMode =
  | 'single_estimate'
  | 'estimate_with_uncertainty'
  | 'modelled_range'

export type PopulationConfidenceReason =
  | 'models_highly_divergent'
  | 'models_moderately_divergent'
  | 'sparse_built_environment'
  | 'constrained_population_concentration'
  | 'rural_distribution_uncertainty'
  | 'geometry_smaller_than_recommended_scale'
  | 'local_estimate_scale_sensitive'
  | 'partial_coverage'
  | 'validation_unavailable'
  | 'settlement_dataset_limited'

export interface PopulationModelDifferenceMetrics {
  absoluteDifference: number
  percentageDifference: number
  ratioBetweenModels: number | null
  lowerEstimate: number
  upperEstimate: number
}

export interface PopulationEstimateConfidence {
  level: PopulationConfidenceLevel
  agreementClass: PopulationAgreementClass
  primaryEstimate: number
  validationEstimate?: number
  lowerEstimate: number
  upperEstimate: number
  midpointEstimate?: number
  absoluteDifference: number
  percentageDifference: number
  ratioBetweenModels: number | null
  usePointEstimate: boolean
  recommendedDisplayMode: PopulationRecommendedDisplayMode
  reasons: PopulationConfidenceReason[]
  disclaimer: string
}

export interface PopulationConfidenceTerritorialFactors {
  builtUpFractionPct?: number
  settlementDistanceM?: number
  radiusM: number
  dataCoveragePct?: number
  validPixelCountEstimate?: number
  partialCoverage?: boolean
  settlementDatasetLimited?: boolean
}

const RANGE_DISCLAIMER =
  'El rango muestra la divergencia entre modelos espaciales WorldPop; no constituye un intervalo estadístico ni margen de error.'

const SINGLE_DISCLAIMER =
  'Estimación basada en modelo constrained con concordancia razonable respecto al modelo de validación.'

export function computeModelDifferenceMetrics(
  primaryEstimate: number,
  validationEstimate?: number,
): PopulationModelDifferenceMetrics {
  const primary = Math.max(0, primaryEstimate)
  const validation = validationEstimate != null ? Math.max(0, validationEstimate) : primary
  const lowerEstimate = Math.min(primary, validation)
  const upperEstimate = Math.max(primary, validation)
  const absoluteDifference = Math.round(upperEstimate - lowerEstimate)

  if (validationEstimate == null) {
    return {
      absoluteDifference: 0,
      percentageDifference: 0,
      ratioBetweenModels: null,
      lowerEstimate: primary,
      upperEstimate: primary,
    }
  }

  if (upperEstimate === 0) {
    return {
      absoluteDifference: 0,
      percentageDifference: 0,
      ratioBetweenModels: 1,
      lowerEstimate: 0,
      upperEstimate: 0,
    }
  }

  let percentageDifference: number
  let ratioBetweenModels: number | null

  if (lowerEstimate === 0) {
    percentageDifference = 100
    ratioBetweenModels = null
  } else {
    percentageDifference = Math.round((absoluteDifference / lowerEstimate) * 10000) / 100
    ratioBetweenModels = Math.round((upperEstimate / lowerEstimate) * 100) / 100
  }

  return {
    absoluteDifference,
    percentageDifference,
    ratioBetweenModels,
    lowerEstimate,
    upperEstimate,
  }
}

function classifyAgreement(percentageDifference: number): PopulationAgreementClass {
  const abs = Math.abs(percentageDifference)
  if (abs < 5) return 'close'
  if (abs < 20) return 'moderate_difference'
  if (abs < 100) return 'large_difference'
  return 'extreme_difference'
}

function levelFromAgreement(agreement: PopulationAgreementClass): PopulationConfidenceLevel {
  switch (agreement) {
    case 'close':
      return 'high'
    case 'moderate_difference':
      return 'moderate'
    case 'large_difference':
      return 'low'
    case 'extreme_difference':
      return 'very_low'
  }
}

function displayModeFromLevel(level: PopulationConfidenceLevel): PopulationRecommendedDisplayMode {
  switch (level) {
    case 'high':
      return 'single_estimate'
    case 'moderate':
      return 'estimate_with_uncertainty'
    case 'low':
    case 'very_low':
      return 'modelled_range'
  }
}

export function buildPopulationEstimateConfidence(input: {
  primaryEstimate: number
  validationEstimate?: number
  territorial?: PopulationConfidenceTerritorialFactors
}): PopulationEstimateConfidence {
  const metrics = computeModelDifferenceMetrics(
    input.primaryEstimate,
    input.validationEstimate,
  )

  const agreementClass =
    input.validationEstimate == null
      ? 'moderate_difference'
      : classifyAgreement(metrics.percentageDifference)

  let level = levelFromAgreement(agreementClass)
  if (input.validationEstimate == null) {
    level = 'moderate'
  }

  const reasons: PopulationConfidenceReason[] = []

  if (input.validationEstimate == null) {
    reasons.push('validation_unavailable')
  } else if (agreementClass === 'extreme_difference') {
    reasons.push('models_highly_divergent')
  } else if (agreementClass === 'large_difference') {
    reasons.push('models_moderately_divergent')
  }

  const factors = input.territorial
  if (factors) {
    if (factors.partialCoverage || (factors.dataCoveragePct != null && factors.dataCoveragePct < 90)) {
      reasons.push('partial_coverage')
      if (level === 'high') level = 'moderate'
    }
    if (factors.builtUpFractionPct != null && factors.builtUpFractionPct < 15) {
      reasons.push('sparse_built_environment')
      reasons.push('rural_distribution_uncertainty')
    }
    if (
      metrics.ratioBetweenModels != null &&
      metrics.ratioBetweenModels >= 3 &&
      factors.builtUpFractionPct != null &&
      factors.builtUpFractionPct < 25
    ) {
      reasons.push('constrained_population_concentration')
    }
    if (factors.settlementDatasetLimited) {
      reasons.push('settlement_dataset_limited')
    }
    if (factors.radiusM <= 500) {
      reasons.push('geometry_smaller_than_recommended_scale')
      const cells = factors.validPixelCountEstimate ?? estimatePixelCount(factors.radiusM)
      if (cells < 20 || level === 'low' || level === 'very_low') {
        reasons.push('local_estimate_scale_sensitive')
        if (level === 'high') level = 'moderate'
      }
    }
  }

  const recommendedDisplayMode = displayModeFromLevel(level)
  const usePointEstimate =
    recommendedDisplayMode === 'single_estimate' ||
    (recommendedDisplayMode === 'estimate_with_uncertainty' && level === 'moderate')

  return {
    level,
    agreementClass,
    primaryEstimate: input.primaryEstimate,
    validationEstimate: input.validationEstimate,
    lowerEstimate: metrics.lowerEstimate,
    upperEstimate: metrics.upperEstimate,
    midpointEstimate: undefined,
    absoluteDifference: metrics.absoluteDifference,
    percentageDifference: metrics.percentageDifference,
    ratioBetweenModels: metrics.ratioBetweenModels,
    usePointEstimate,
    recommendedDisplayMode,
    reasons: [...new Set(reasons)],
    disclaimer:
      recommendedDisplayMode === 'modelled_range' ? RANGE_DISCLAIMER : SINGLE_DISCLAIMER,
  }
}

function estimatePixelCount(radiusM: number): number {
  const areaHa = (Math.PI * radiusM * radiusM) / 10_000
  return Math.round(areaHa)
}

export function formatModelledRangeLabel(lower: number, upper: number): string {
  const fmt = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)} mil`
    return String(Math.round(n))
  }
  return `${fmt(lower)}–${fmt(upper)}`
}

export const CONFIDENCE_LEVEL_LABELS: Record<PopulationConfidenceLevel, string> = {
  high: 'Confianza alta',
  moderate: 'Incertidumbre moderada',
  low: 'Confianza local baja',
  very_low: 'Confianza local muy baja',
}

export const RANGE_TOOLTIP =
  'Los modelos de distribución poblacional producen resultados diferentes para este entorno. El rango muestra ambos resultados y no constituye un intervalo estadístico.'
