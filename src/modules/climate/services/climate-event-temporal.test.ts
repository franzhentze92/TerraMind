import { describe, expect, it } from 'vitest'

import type { ClimateHourlyPoint } from '@/modules/climate/types/climate.types'
import {
  computeDryDaysConsecutive,
  matchClosestHourlyPoint,
} from '@/modules/climate/services/climate-event-temporal'

function hourlyAt(iso: string, precip = 0): ClimateHourlyPoint {
  return {
    timestamp_utc: iso,
    temperature_c: 25,
    relative_humidity_pct: 60,
    precipitation_mm: precip,
    rain_mm: precip,
    wind_speed_10m_kph: 10,
    wind_direction_10m_deg: 90,
    wind_gusts_10m_kph: 15,
    cloud_cover_pct: 20,
    temporal_phase: 'previous',
  }
}

describe('climate-event-temporal', () => {
  it('matches closest hourly within tolerance', () => {
    const hourly = [
      hourlyAt('2026-01-01T09:00:00Z'),
      hourlyAt('2026-01-01T10:00:00Z'),
      hourlyAt('2026-01-01T11:00:00Z'),
    ]
    const match = matchClosestHourlyPoint(hourly, '2026-01-01T10:20:00Z', 90)
    expect(match.outsideTolerance).toBe(false)
    expect(match.offsetMinutes).toBeLessThanOrEqual(60)
  })

  it('flags offset outside tolerance but still returns nearest point', () => {
    const hourly = [hourlyAt('2026-01-01T06:00:00Z')]
    const match = matchClosestHourlyPoint(hourly, '2026-01-01T10:00:00Z', 90)
    expect(match.outsideTolerance).toBe(true)
    expect(match.point).not.toBeNull()
  })

  it('counts dry days consecutively', () => {
    const hourly: ClimateHourlyPoint[] = []
    for (let d = 1; d <= 5; d += 1) {
      for (let h = 12; h < 24; h += 1) {
        const precip = d >= 5 ? 2 : 0
        hourly.push(
          hourlyAt(
            `2026-01-0${d}T${String(h).padStart(2, '0')}:00:00Z`,
            precip,
          ),
        )
      }
    }
    const dry = computeDryDaysConsecutive(
      hourly,
      '2026-01-05T20:00:00Z',
      1,
      'UTC',
    )
    expect(dry).toBeGreaterThanOrEqual(1)
  })
})
