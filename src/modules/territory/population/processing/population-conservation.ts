/**
 * Tolerancias de conservación técnica (no confundir con concordancia INE).
 */
export type ConservationVerdict = 'pass' | 'warning' | 'reject'

export const CONSERVATION_PASS_MAX_PCT = 0.1
export const CONSERVATION_WARNING_MAX_PCT = 0.5

export interface ConservationEvaluation {
  deltaPct: number
  verdict: ConservationVerdict
  approved: boolean
  message: string
}

export function evaluateConservationDeltaPct(deltaPct: number): ConservationEvaluation {
  const delta = Math.abs(deltaPct)
  if (delta <= CONSERVATION_PASS_MAX_PCT) {
    return {
      deltaPct: delta,
      verdict: 'pass',
      approved: true,
      message: `Conservación ≤ ${CONSERVATION_PASS_MAX_PCT}%`,
    }
  }
  if (delta <= CONSERVATION_WARNING_MAX_PCT) {
    return {
      deltaPct: delta,
      verdict: 'warning',
      approved: false,
      message: `Advertencia: ${delta}% (> ${CONSERVATION_PASS_MAX_PCT}%, ≤ ${CONSERVATION_WARNING_MAX_PCT}%)`,
    }
  }
  return {
    deltaPct: delta,
    verdict: 'reject',
    approved: false,
    message: `Rechazado: ${delta}% (> ${CONSERVATION_WARNING_MAX_PCT}%)`,
  }
}

export function populationDiffPct(reference: number, observed: number): number {
  if (reference === 0) return observed === 0 ? 0 : 100
  return Math.round((Math.abs(observed - reference) / reference) * 10000) / 100
}
