import type { Evidence, Hypothesis } from '@/intelligence/types'
import { scoreConfidence } from '@/intelligence/confidence'

export function createHypothesis(
  claim: string,
  supporting: Evidence[],
  contradicting: Evidence[] = [],
): Omit<Hypothesis, 'id' | 'generatedAt'> {
  return {
    claim,
    supportingEvidence: supporting,
    contradictingEvidence: contradicting,
    confidence: scoreConfidence(supporting),
    status: 'active',
  }
}
