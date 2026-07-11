/**
 * Rainfall deficit — candidate evaluation with auditable decisions.
 */
import type {
  RainfallDeficitDetectionDecision,
  RainfallDeficitDetectionRuleResult,
} from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.types'
import type { RainfallWindowMetrics } from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.types'
import {
  CANDIDATE_THRESHOLD,
  ELEVATED_THRESHOLD,
  MINIMUM_EXPECTED_RAINFALL_MM,
  RAINFALL_DEFICIT_ALGORITHM_VERSION,
  SEVERE_THRESHOLD,
  type RainfallDeficitThresholdTier,
} from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.config'
import { hasSufficientHistory } from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.climatology'
import { CHIRPS_V3_MIN_HISTORY_YEARS } from '@/modules/precipitation/chirps-v3/chirps-v3.config'

export type IntensityClass = 'moderate' | 'elevated' | 'severe' | 'recovering'

function rule(id: string, satisfied: boolean, value?: number | string, threshold?: number | string): RainfallDeficitDetectionRuleResult {
  return { ruleId: id, satisfied, value, threshold }
}

function meetsTier(metrics: RainfallWindowMetrics, tier: RainfallDeficitThresholdTier, consecutivePentads: number): boolean {
  if (metrics.expectedRainfallMm === undefined || metrics.expectedRainfallMm < MINIMUM_EXPECTED_RAINFALL_MM) return false
  if (metrics.relativeDeficitPercent === undefined || metrics.relativeDeficitPercent < tier.relativeDeficitPercent) return false
  if (metrics.historicalPercentile === undefined || metrics.historicalPercentile > tier.historicalPercentileMax) return false
  if (consecutivePentads < tier.minConsecutivePentads) return false
  return true
}

export function classifyIntensity(
  metrics: RainfallWindowMetrics,
  consecutivePentads: number,
  recovering: boolean,
): IntensityClass {
  if (recovering) return 'recovering'
  if (meetsTier(metrics, SEVERE_THRESHOLD, consecutivePentads)) return 'severe'
  if (meetsTier(metrics, ELEVATED_THRESHOLD, consecutivePentads)) return 'elevated'
  if (meetsTier(metrics, CANDIDATE_THRESHOLD, consecutivePentads)) return 'moderate'
  return 'moderate'
}

export function evaluateCandidateDecision(
  cellId: string,
  metrics: RainfallWindowMetrics,
  historicalSamples: number[],
  consecutivePentads: number,
): RainfallDeficitDetectionDecision {
  const satisfied: RainfallDeficitDetectionRuleResult[] = []
  const unsatisfied: RainfallDeficitDetectionRuleResult[] = []

  const push = (r: RainfallDeficitDetectionRuleResult) => (r.satisfied ? satisfied : unsatisfied).push(r)

  push(rule('HISTORY_SUFFICIENT', hasSufficientHistory(historicalSamples), historicalSamples.length, CHIRPS_V3_MIN_HISTORY_YEARS))
  push(
    rule(
      'EXPECTED_RAINFALL_FLOOR',
      metrics.expectedRainfallMm !== undefined && metrics.expectedRainfallMm >= MINIMUM_EXPECTED_RAINFALL_MM,
      metrics.expectedRainfallMm,
      MINIMUM_EXPECTED_RAINFALL_MM,
    ),
  )
  push(
    rule(
      'RELATIVE_DEFICIT',
      metrics.relativeDeficitPercent !== undefined && metrics.relativeDeficitPercent >= CANDIDATE_THRESHOLD.relativeDeficitPercent,
      metrics.relativeDeficitPercent,
      CANDIDATE_THRESHOLD.relativeDeficitPercent,
    ),
  )
  push(
    rule(
      'HISTORICAL_PERCENTILE',
      metrics.historicalPercentile !== undefined && metrics.historicalPercentile <= CANDIDATE_THRESHOLD.historicalPercentileMax,
      metrics.historicalPercentile,
      CANDIDATE_THRESHOLD.historicalPercentileMax,
    ),
  )
  push(
    rule(
      'PERSISTENCE_PENTADS',
      consecutivePentads >= CANDIDATE_THRESHOLD.minConsecutivePentads,
      consecutivePentads,
      CANDIDATE_THRESHOLD.minConsecutivePentads,
    ),
  )

  const isCandidate = satisfied.length === 5
  return {
    id: `dec_${cellId}_${Date.now()}`,
    algorithmVersion: RAINFALL_DEFICIT_ALGORITHM_VERSION,
    evaluatedAt: new Date().toISOString(),
    cellId,
    satisfiedRules: satisfied,
    unsatisfiedRules: unsatisfied,
    isCandidate,
    rationale: isCandidate
      ? 'Celda cumple historia, piso estacional, déficit relativo, percentil y persistencia.'
      : 'Celda no cumple todos los criterios simultáneos.',
  }
}
