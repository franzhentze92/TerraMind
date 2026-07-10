import type {
  PopulationConfidenceReason,
  PopulationEstimateConfidence,
} from '@/modules/territory/population/population-estimate-confidence'
import {
  buildPopulationEstimateConfidence,
  formatModelledRangeLabel,
} from '@/modules/territory/population/population-estimate-confidence'
import type { PopulationZoneDto } from '@/modules/fires/types/fire.dto'

export function populationZoneDtoToConfidence(zone: PopulationZoneDto): PopulationEstimateConfidence {
  const base = buildPopulationEstimateConfidence({
    primaryEstimate: zone.estimated_population,
    validationEstimate: zone.validation_estimate,
  })
  if (!zone.confidence) return base

  return {
    ...base,
    level: zone.confidence.level,
    agreementClass: zone.confidence.agreement_class,
    recommendedDisplayMode: zone.confidence.recommended_display_mode,
    lowerEstimate: zone.modelled_range?.lower ?? base.lowerEstimate,
    upperEstimate: zone.modelled_range?.upper ?? base.upperEstimate,
    usePointEstimate:
      zone.confidence.recommended_display_mode === 'single_estimate' ||
      zone.confidence.recommended_display_mode === 'estimate_with_uncertainty',
    reasons: zone.confidence.reasons as PopulationConfidenceReason[],
    disclaimer: zone.confidence.disclaimer ?? base.disclaimer,
  }
}

export function buildPopulationZoneNarrativeFromDto(zone: PopulationZoneDto): string {
  return buildPopulationZoneNarrative({
    radiusM: zone.radius_m,
    confidence: populationZoneDtoToConfidence(zone),
  })
}

export function buildPopulationZoneNarrative(input: {
  radiusM: number
  confidence: PopulationEstimateConfidence
}): string {
  const radiusLabel = input.radiusM >= 1000 ? `${input.radiusM / 1000} km` : `${input.radiusM} m`
  const { confidence } = input

  if (confidence.level === 'high') {
    const est = Math.round(confidence.primaryEstimate)
    return `Se estima que aproximadamente ${est.toLocaleString('es-GT')} personas residen dentro de ${radiusLabel}.`
  }

  if (confidence.level === 'moderate') {
    const est = Math.round(confidence.primaryEstimate)
    return `Se estima que aproximadamente ${est.toLocaleString('es-GT')} personas residen dentro de ${radiusLabel}, con incertidumbre moderada entre modelos espaciales.`
  }

  const range = formatModelledRangeLabel(confidence.lowerEstimate, confidence.upperEstimate)
  return `Los modelos estiman entre ${range} residentes dentro de ${radiusLabel}. La distribución poblacional local presenta alta incertidumbre.`
}

export function buildPopulationEventSummaryNarrative(input: {
  zone: PopulationZoneDto
  nearestSettlementName?: string
  nearestSettlementDistanceM?: number
}): string {
  const base = buildPopulationZoneNarrativeFromDto(input.zone)

  if (input.nearestSettlementName && input.nearestSettlementDistanceM != null) {
    const km = (input.nearestSettlementDistanceM / 1000).toFixed(1)
    return `${base} La cabecera municipal más cercana (${input.nearestSettlementName}) se encuentra a ${km} km.`
  }

  return base
}

/** Evitar términos prohibidos en narrativas públicas. */
export function assertPopulationNarrativeSafe(text: string): void {
  const forbidden = [
    'afectad',
    'evacuad',
    'en riesgo',
    'intervalo de confianza',
    'margen de error',
    'rango probable',
  ]
  const lower = text.toLowerCase()
  for (const term of forbidden) {
    if (lower.includes(term)) {
      throw new Error(`Narrativa poblacional contiene término prohibido: ${term}`)
    }
  }
}
