import { describe, expect, it } from 'vitest'
import {
  buildCountryLocationKey,
  buildDepartmentLocationKey,
  buildEntityLocationKey,
} from './location-key'

describe('location-key', () => {
  it('builds deterministic entity keys', () => {
    expect(buildCountryLocationKey('gt')).toBe('country:geo_countries:GT')
    expect(buildDepartmentLocationKey('GT', '16')).toBe('department:geo_departments:GT:16')
    expect(buildEntityLocationKey('station', 'insivumeh', 'sta-01')).toBe(
      'station:insivumeh:sta-01',
    )
  })
})
