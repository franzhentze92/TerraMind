import { describe, expect, it } from 'vitest'
import { satelliteDisplayName, sourceProductDisplayName } from './source-labels'

describe('source labels', () => {
  it('maps FIRMS source products to human names', () => {
    expect(sourceProductDisplayName('VIIRS_SNPP_NRT')).toBe('VIIRS S-NPP')
    expect(sourceProductDisplayName('VIIRS_NOAA20_NRT')).toBe('VIIRS NOAA-20')
    expect(sourceProductDisplayName('VIIRS_NOAA21_NRT')).toBe('VIIRS NOAA-21')
    expect(sourceProductDisplayName('MODIS_NRT')).toBe('MODIS')
  })

  it('falls back to raw code for unknown sources', () => {
    expect(sourceProductDisplayName('UNKNOWN_SOURCE')).toBe('UNKNOWN_SOURCE')
  })

  it('maps satellite codes to human names', () => {
    expect(satelliteDisplayName('N')).toBe('Suomi NPP')
    expect(satelliteDisplayName('N20')).toBe('NOAA-20')
    expect(satelliteDisplayName('N21')).toBe('NOAA-21')
    expect(satelliteDisplayName('A')).toBe('Aqua')
    expect(satelliteDisplayName('T')).toBe('Terra')
  })

  it('handles null satellite', () => {
    expect(satelliteDisplayName(null)).toBe('—')
  })
})
