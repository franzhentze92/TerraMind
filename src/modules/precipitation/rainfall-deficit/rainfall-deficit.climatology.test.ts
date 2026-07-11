/**
 * Tests — rainfall deficit climatology and dry-season protection.
 */
import { describe, expect, it } from 'vitest'
import {
  buildHistoricalDistribution,
  computeWindowMetrics,
  empiricalPercentile,
  hasSufficientHistory,
} from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.climatology'
import { MINIMUM_EXPECTED_RAINFALL_MM } from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.config'

describe('rainfall deficit climatology', () => {
  const baselineSamples = [80, 95, 110, 120, 100, 90, 105, 115, 85, 100, 95, 110, 88, 92, 108, 112, 98, 102, 87, 93, 107, 111]

  it('requires at least 20 years for percentiles', () => {
    expect(hasSufficientHistory(baselineSamples)).toBe(true)
    expect(hasSufficientHistory(baselineSamples.slice(0, 10))).toBe(false)
  })

  it('computes empirical percentile', () => {
    expect(empiricalPercentile(50, baselineSamples)).toBeLessThanOrEqual(20)
    expect(empiricalPercentile(120, baselineSamples)).toBeGreaterThan(80)
  })

  it('does not compute relative deficit when expected rainfall is below floor', () => {
    const drySeason = Array(22).fill(2)
    const metrics = computeWindowMetrics(1, drySeason, 30, 6)
    expect(metrics.expectedRainfallMm).toBe(2)
    expect(metrics.relativeDeficitPercent).toBeUndefined()
  })

  it('computes deficit for real anomaly', () => {
    const metrics = computeWindowMetrics(40, baselineSamples, 30, 6)
    expect(metrics.relativeDeficitPercent).toBeGreaterThan(30)
    expect(metrics.historicalPercentile).toBeLessThanOrEqual(20)
  })

  it('wet period does not show deficit', () => {
    const metrics = computeWindowMetrics(130, baselineSamples, 30, 6)
    expect((metrics.relativeDeficitPercent ?? 0)).toBeLessThan(10)
    expect((metrics.historicalPercentile ?? 0)).toBeGreaterThan(70)
  })

  it('documents minimum expected rainfall floor', () => {
    expect(MINIMUM_EXPECTED_RAINFALL_MM).toBeGreaterThan(0)
    const hist = buildHistoricalDistribution([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20])
    expect(hist.sampleYears).toBe(20)
  })
})
