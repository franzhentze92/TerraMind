import { describe, expect, it } from 'vitest'

import { computeThermalResultCounts } from '@/modules/fires/utils/thermal-result-count'

describe('computeThermalResultCounts', () => {
  it('uses server filtered total as visible count without Math.max', () => {
    const counts = computeThermalResultCounts({
      serverFilteredTotal: 12,
      currentPageItems: [1, 2, 3],
      isFetching: false,
      isPlaceholderData: false,
    })
    expect(counts.serverFilteredTotal).toBe(12)
    expect(counts.currentPageItemCount).toBe(3)
    expect(counts.visibleResultCount).toBe(12)
  })

  it('returns zero visible rows while placeholder fetch is in flight', () => {
    const counts = computeThermalResultCounts({
      serverFilteredTotal: 0,
      currentPageItems: [{ id: 'stale' }],
      isFetching: true,
      isPlaceholderData: true,
    })
    expect(counts.visibleResultCount).toBe(0)
    expect(counts.currentPageItemCount).toBe(0)
  })

  it('handles empty filter results', () => {
    const counts = computeThermalResultCounts({
      serverFilteredTotal: 0,
      currentPageItems: [],
      isFetching: false,
      isPlaceholderData: false,
    })
    expect(counts.visibleResultCount).toBe(0)
  })

  it('keeps pagination total when page is partial', () => {
    const counts = computeThermalResultCounts({
      serverFilteredTotal: 40,
      currentPageItems: new Array(25).fill({}),
      isFetching: false,
      isPlaceholderData: false,
    })
    expect(counts.visibleResultCount).toBe(40)
    expect(counts.currentPageItemCount).toBe(25)
  })
})
