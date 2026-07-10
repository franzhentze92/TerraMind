import type {
  DerivedVerificationNeed,
  RankedMethodCandidate,
  VerificationMethodDef,
  VerificationNeedType,
} from '@/modules/verification/verification.types'
import {
  AVAILABILITY_SCORE,
  COST_BAND_SCORE,
  FIRE_VERIFICATION_METHOD_CATALOG,
  FIRE_VERIFICATION_METHOD_CATALOG_VERSION,
  METHOD_RANKING_WEIGHTS,
  TIME_BAND_URGENCY_FIT,
} from '@/modules/verification/config/fire-verification.config'

function urgencyForNeed(need: DerivedVerificationNeed): number {
  if (need.recommended_window_hours <= 12) return 1
  if (need.recommended_window_hours <= 24) return 0.85
  if (need.recommended_window_hours <= 48) return 0.65
  return 0.4
}

function rankMethodForNeed(
  method: VerificationMethodDef,
  need: DerivedVerificationNeed,
  hoursSinceLastObservation: number,
): RankedMethodCandidate {
  const supports = method.supported_need_types.includes(need.need_type)
  const suitability = supports ? 1 : 0

  const informationGain = method.expected_information_gain
  const urgencyFit =
    TIME_BAND_URGENCY_FIT[method.estimated_time_band] * urgencyForNeed(need)
  const costEfficiency = COST_BAND_SCORE[method.estimated_cost_band] ?? 0.5
  const availability = AVAILABILITY_SCORE[method.availability_status] ?? 0.4
  const evidenceStrength = method.evidence_strength

  const isBlocked =
    method.availability_status === 'unavailable' ||
    !supports ||
    (method.requires_field_presence &&
      hoursSinceLastObservation > need.recommended_window_hours * 2 &&
      need.need_type === 'confirm_recent_activity')

  const rankingReasons: string[] = []
  const rankingLimitations: string[] = [...method.limitations]
  const constraints = [
    ...method.geographic_constraints,
    ...method.weather_constraints,
    ...method.safety_constraints,
  ]

  if (supports) rankingReasons.push('Método compatible con el tipo de necesidad')
  if (method.expected_information_gain >= 0.75) {
    rankingReasons.push('Alto valor informativo esperado')
  }
  if (method.availability_status === 'available') {
    rankingReasons.push('Disponible sin dependencia bloqueante')
  }
  if (method.requires_external_provider) {
    rankingLimitations.push('Requiere proveedor externo')
  }
  if (method.requires_field_presence) {
    rankingLimitations.push('Requiere presencia en campo')
  }
  if (isBlocked) rankingLimitations.push('Método bloqueado por disponibilidad o ventana')

  const composite =
    suitability * METHOD_RANKING_WEIGHTS.relevance +
    informationGain * METHOD_RANKING_WEIGHTS.information_gain +
    urgencyFit * METHOD_RANKING_WEIGHTS.urgency_fit +
    costEfficiency * METHOD_RANKING_WEIGHTS.cost_efficiency +
    availability * METHOD_RANKING_WEIGHTS.availability +
    evidenceStrength * METHOD_RANKING_WEIGHTS.evidence_strength

  return {
    method_id: method.method_id,
    method_type: method.method_type,
    is_recommended: false,
    is_alternative: false,
    is_blocked: isBlocked,
    suitability_score: round4(suitability),
    information_gain_score: round4(informationGain),
    urgency_fit_score: round4(urgencyFit),
    cost_efficiency_score: round4(costEfficiency),
    availability_score: round4(availability),
    evidence_strength_score: round4(evidenceStrength),
    ranking_reasons: rankingReasons,
    ranking_limitations: rankingLimitations,
    constraints,
    _composite: composite,
  } as RankedMethodCandidate & { _composite: number }
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000
}

export function rankMethodsForNeed(
  need: DerivedVerificationNeed,
  hoursSinceLastObservation: number,
  catalog: VerificationMethodDef[] = FIRE_VERIFICATION_METHOD_CATALOG,
): {
  recommended: RankedMethodCandidate | null
  alternatives: RankedMethodCandidate[]
  selection_reason: string
} {
  const ranked = catalog
    .map((m) => rankMethodForNeed(m, need, hoursSinceLastObservation))
    .filter((m) => (m as RankedMethodCandidate & { _composite: number })._composite > 0)
    .sort((a, b) => {
      const blockedDiff = Number(a.is_blocked) - Number(b.is_blocked)
      if (blockedDiff !== 0) return blockedDiff
      const compA = (a as RankedMethodCandidate & { _composite: number })._composite
      const compB = (b as RankedMethodCandidate & { _composite: number })._composite
      if (compB !== compA) return compB - compA
      return a.method_id.localeCompare(b.method_id)
    })
    .map((m) => {
      const { _composite: _, ...rest } = m as RankedMethodCandidate & { _composite: number }
      return rest
    })

  const available = ranked.filter((m) => !m.is_blocked)
  const recommended = available[0] ?? null
  const alternatives = (recommended ? available.slice(1) : ranked.filter((m) => !m.is_blocked))
    .slice(0, 3)
    .map((m) => ({ ...m, is_alternative: true }))

  if (recommended) {
    recommended.is_recommended = true
    return {
      recommended,
      alternatives,
      selection_reason: `Método ${recommended.method_id} seleccionado por compatibilidad, valor informativo y ajuste a ventana de ${need.recommended_window_hours}h`,
    }
  }

  const blockedAlt = ranked.slice(0, 2).map((m) => ({ ...m, is_alternative: true }))
  return {
    recommended: null,
    alternatives: blockedAlt,
    selection_reason: 'Sin método principal disponible; alternativas bloqueadas o incompatibles',
  }
}

export function dedupeMethodsAcrossNeeds(
  needs: Array<{
    need_type: VerificationNeedType
    recommended_method: RankedMethodCandidate | null
    alternative_methods: RankedMethodCandidate[]
  }>,
): void {
  const used = new Set<string>()
  for (const need of needs) {
    if (need.recommended_method && used.has(need.recommended_method.method_id)) {
      const alt = need.alternative_methods.find((a) => !used.has(a.method_id) && !a.is_blocked)
      if (alt) {
        need.recommended_method.is_recommended = false
        need.recommended_method.is_alternative = true
        need.alternative_methods = [
          alt,
          ...need.alternative_methods.filter((a) => a.method_id !== alt.method_id),
        ]
        alt.is_recommended = true
        alt.is_alternative = false
        need.recommended_method = alt
      }
    }
    if (need.recommended_method) used.add(need.recommended_method.method_id)
  }
}

export { FIRE_VERIFICATION_METHOD_CATALOG_VERSION }
