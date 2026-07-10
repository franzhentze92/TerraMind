import { describe, expect, it } from 'vitest'
import {
  buildBiodiversidadPath,
  parseBiodiversityPageFilters,
} from './biodiversity-page-filters'

describe('biodiversity-page-filters', () => {
  it('parses query string filters', () => {
    const filters = parseBiodiversityPageFilters(
      new URLSearchParams('period=5y&taxon=birds&source=all&zone=maya'),
    )
    expect(filters.period).toBe('5y')
    expect(filters.taxon).toBe('birds')
    expect(filters.zone).toBe('maya')
  })

  it('falls back to defaults for invalid values', () => {
    const filters = parseBiodiversityPageFilters(
      new URLSearchParams('period=invalid&taxon=birds'),
    )
    expect(filters.period).toBe('30d')
    expect(filters.taxon).toBe('birds')
  })

  it('builds biodiversidad path with query string', () => {
    const path = buildBiodiversidadPath({
      period: '5y',
      source: 'all',
      taxon: 'birds',
      quality: 'all',
      zone: 'maya',
    })
    expect(path).toBe('/biodiversidad?period=5y&taxon=birds&zone=maya')
  })
})
