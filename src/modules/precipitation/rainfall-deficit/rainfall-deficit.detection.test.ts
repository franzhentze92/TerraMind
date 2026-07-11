/**
 * Tests — rainfall deficit detection decisions.
 */
import { describe, expect, it } from 'vitest'
import {
  classifyIntensity,
  evaluateCandidateDecision,
} from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.detection'
import { computeWindowMetrics } from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.climatology'

const baseline = [80, 95, 110, 120, 100, 90, 105, 115, 85, 100, 95, 110, 88, 92, 108, 112, 98, 102, 87, 93, 107, 111]

describe('rainfall deficit detection', () => {
  it('rejects candidate when only deficit % is high but expected is near zero', () => {
    const dry = Array(22).fill(3)
    const metrics = computeWindowMetrics(1, dry, 30, 6)
    const decision = evaluateCandidateDecision('0,0', metrics, dry, 3)
    expect(decision.isCandidate).toBe(false)
    expect(decision.unsatisfiedRules.some((r) => r.ruleId === 'EXPECTED_RAINFALL_FLOOR')).toBe(true)
  })

  it('accepts candidate when all rules satisfied', () => {
    const metrics = computeWindowMetrics(35, baseline, 30, 6)
    const decision = evaluateCandidateDecision('1,1', metrics, baseline, 2)
    expect(decision.isCandidate).toBe(true)
    expect(decision.satisfiedRules).toHaveLength(5)
  })

  it('classifies severe intensity', () => {
    const metrics = computeWindowMetrics(30, baseline, 30, 6)
    expect(classifyIntensity(metrics, 4, false)).toBe('severe')
  })

  it('classifies recovering', () => {
    const metrics = computeWindowMetrics(35, baseline, 30, 6)
    expect(classifyIntensity(metrics, 2, true)).toBe('recovering')
  })
})
