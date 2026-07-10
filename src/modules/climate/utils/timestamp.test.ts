import { describe, expect, it } from 'vitest'
import { openMeteoLocalTimeToUtc } from './timestamp'

describe('timestamp', () => {
  it('converts America/Guatemala local Open-Meteo time to UTC', () => {
    const utc = openMeteoLocalTimeToUtc('2026-07-10T03:15', -21_600)
    expect(utc).toBe('2026-07-10T09:15:00.000Z')
  })
})
