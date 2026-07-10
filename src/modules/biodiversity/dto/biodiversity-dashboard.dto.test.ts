import { describe, expect, it } from 'vitest'
import {
  filtersToQueryString,
  parseBiodiversityDashboardFilters,
  periodToObservedFrom,
} from './biodiversity-dashboard.dto'

describe('biodiversity-dashboard.dto', () => {
  it('parses valid dashboard filters with defaults', () => {
    const result = parseBiodiversityDashboardFilters(new URLSearchParams())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.period).toBe('30d')
      expect(result.data.source).toBe('all')
      expect(result.data.zone).toBe('all')
    }
  })

  it('rejects invalid period', () => {
    const result = parseBiodiversityDashboardFilters(new URLSearchParams({ period: '10y' }))
    expect(result.ok).toBe(false)
  })

  it('rejects invalid zone code', () => {
    const result = parseBiodiversityDashboardFilters(new URLSearchParams({ zone: 'invalid-zone' }))
    expect(result.ok).toBe(false)
  })

  it('accepts configured zone codes', () => {
    const result = parseBiodiversityDashboardFilters(new URLSearchParams({ zone: 'maya' }))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.zone).toBe('maya')
  })

  it('maps period to observedFrom date', () => {
    const from = periodToObservedFrom('30d', new Date('2026-07-10T12:00:00.000Z'))
    expect(from).toBe('2026-06-10')
  })

  it('serializes filters to query string', () => {
    const qs = filtersToQueryString({
      period: '5y',
      source: 'gbif',
      taxon: 'birds',
      quality: 'research',
      zone: 'maya',
    })
    expect(qs).toContain('period=5y')
    expect(qs).toContain('taxon=birds')
    expect(qs).toContain('zone=maya')
  })
})
