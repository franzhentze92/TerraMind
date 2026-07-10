import { describe, expect, it } from 'vitest'

import { buildClimateContextVersion } from '@/modules/climate/climate-context-version'

describe('buildClimateContextVersion', () => {
  it('is deterministic', () => {
    const input = {
      provider: 'open_meteo',
      model: 'open-meteo-forecast',
      variables: ['temperature_2m', 'precipitation'],
      eventTimeMatchingMethod: 'closest_hourly',
      representativePoints: 3,
      temporalToleranceMinutes: 90,
      dryDayThresholdMm: 1,
      accumulationWindows: '24h,7d,30d',
      forecastWindows: '24h,72h',
      timezone: 'America/Guatemala',
      aggregationMethod: 'multi_point_min_max_mean',
    }
    expect(buildClimateContextVersion(input)).toBe(buildClimateContextVersion(input))
  })
})
