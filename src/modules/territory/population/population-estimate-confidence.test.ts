import { describe, expect, it } from 'vitest'

import {
  buildPopulationEstimateConfidence,
  computeModelDifferenceMetrics,
  formatModelledRangeLabel,
} from '@/modules/territory/population/population-estimate-confidence'
import {
  assertPopulationNarrativeSafe,
  buildPopulationZoneNarrative,
} from '@/modules/fires/utils/population-narrative'

describe('population-estimate-confidence', () => {
  it('classifies Jutiapa as high confidence (~1.9%)', () => {
    const c = buildPopulationEstimateConfidence({
      primaryEstimate: 794,
      validationEstimate: 809,
    })
    expect(c.level).toBe('high')
    expect(c.agreementClass).toBe('close')
    expect(c.recommendedDisplayMode).toBe('single_estimate')
    expect(c.usePointEstimate).toBe(true)
  })

  it('classifies Sacatepéquez as very_low with modelled_range', () => {
    const c = buildPopulationEstimateConfidence({
      primaryEstimate: 11,
      validationEstimate: 1259,
    })
    expect(c.level).toBe('very_low')
    expect(c.agreementClass).toBe('extreme_difference')
    expect(c.recommendedDisplayMode).toBe('modelled_range')
    expect(c.usePointEstimate).toBe(false)
    expect(c.lowerEstimate).toBe(11)
    expect(c.upperEstimate).toBe(1259)
    expect(c.midpointEstimate).toBeUndefined()
  })

  it('handles moderate difference 5-20%', () => {
    const c = buildPopulationEstimateConfidence({
      primaryEstimate: 100,
      validationEstimate: 115,
    })
    expect(c.level).toBe('moderate')
    expect(c.recommendedDisplayMode).toBe('estimate_with_uncertainty')
  })

  it('handles large difference 20-100%', () => {
    const c = buildPopulationEstimateConfidence({
      primaryEstimate: 100,
      validationEstimate: 170,
    })
    expect(c.level).toBe('low')
    expect(c.recommendedDisplayMode).toBe('modelled_range')
  })

  it('handles near-zero denominator without misleading low pct', () => {
    const m = computeModelDifferenceMetrics(0, 402)
    expect(m.percentageDifference).toBe(100)
    expect(m.ratioBetweenModels).toBeNull()
    const c = buildPopulationEstimateConfidence({ primaryEstimate: 0, validationEstimate: 402 })
    expect(c.level).toBe('very_low')
  })

  it('handles both values zero', () => {
    const c = buildPopulationEstimateConfidence({ primaryEstimate: 0, validationEstimate: 0 })
    expect(c.level).toBe('high')
    expect(c.lowerEstimate).toBe(0)
    expect(c.upperEstimate).toBe(0)
  })

  it('handles validation unavailable', () => {
    const c = buildPopulationEstimateConfidence({ primaryEstimate: 500 })
    expect(c.reasons).toContain('validation_unavailable')
    expect(c.recommendedDisplayMode).not.toBe('single_estimate')
  })

  it('orders range correctly', () => {
    const c = buildPopulationEstimateConfidence({
      primaryEstimate: 410,
      validationEstimate: 79,
    })
    expect(c.lowerEstimate).toBe(79)
    expect(c.upperEstimate).toBe(410)
  })

  it('does not use midpoint as official display', () => {
    const c = buildPopulationEstimateConfidence({
      primaryEstimate: 11,
      validationEstimate: 1259,
    })
    expect(c.midpointEstimate).toBeUndefined()
  })

  it('formatModelledRangeLabel uses compact units', () => {
    expect(formatModelledRangeLabel(11, 1259)).toBe('11–1.3 mil')
  })
})

describe('population-narrative', () => {
  it('high confidence narrative uses approximate single estimate', () => {
    const c = buildPopulationEstimateConfidence({
      primaryEstimate: 809,
      validationEstimate: 794,
    })
    const text = buildPopulationZoneNarrative({ radiusM: 1000, confidence: c })
    expect(text).toContain('aproximadamente 809')
    expect(text).not.toContain('11 personas')
    assertPopulationNarrativeSafe(text)
  })

  it('very low confidence uses range not point estimate', () => {
    const c = buildPopulationEstimateConfidence({
      primaryEstimate: 11,
      validationEstimate: 1259,
    })
    const text = buildPopulationZoneNarrative({ radiusM: 1000, confidence: c })
    expect(text).toContain('entre')
    expect(text).not.toMatch(/^Se estima que 11 personas/)
    expect(text).toContain('alta incertidumbre')
    assertPopulationNarrativeSafe(text)
  })

  it('narrative avoids forbidden terms', () => {
    expect(() => assertPopulationNarrativeSafe('100 personas afectadas')).toThrow()
    expect(() => assertPopulationNarrativeSafe('intervalo de confianza 95%')).toThrow()
  })
})
