import { describe, expect, it } from 'vitest'

import {
  CONSERVATION_PASS_MAX_PCT,
  CONSERVATION_WARNING_MAX_PCT,
  evaluateConservationDeltaPct,
  populationDiffPct,
} from '@/modules/territory/population/processing/population-conservation'

describe('evaluateConservationDeltaPct', () => {
  it('passes at or below 0.1%', () => {
    expect(evaluateConservationDeltaPct(0.05).verdict).toBe('pass')
    expect(evaluateConservationDeltaPct(0.1).approved).toBe(true)
  })

  it('warns between 0.1% and 0.5%', () => {
    const w = evaluateConservationDeltaPct(0.27)
    expect(w.verdict).toBe('warning')
    expect(w.approved).toBe(false)
  })

  it('rejects above 0.5%', () => {
    const r = evaluateConservationDeltaPct(1.17)
    expect(r.verdict).toBe('reject')
    expect(r.approved).toBe(false)
  })

  it('uses symmetric absolute delta', () => {
    expect(evaluateConservationDeltaPct(-0.6).verdict).toBe('reject')
  })
})

describe('populationDiffPct', () => {
  it('computes percent difference', () => {
    expect(populationDiffPct(100, 110)).toBe(10)
  })
})

describe('conservation thresholds', () => {
  it('documents tier boundaries', () => {
    expect(CONSERVATION_PASS_MAX_PCT).toBe(0.1)
    expect(CONSERVATION_WARNING_MAX_PCT).toBe(0.5)
  })
})
