import { describe, expect, it } from 'vitest'
import { formatGuatemalaDateTime, formatRelativeMinutes } from '@/modules/fires/utils/format'

describe('fire format utils', () => {
  it('formats UTC timestamps in America/Guatemala', () => {
    const formatted = formatGuatemalaDateTime('2026-07-09T20:12:00.000Z')
    expect(formatted).toMatch(/20:12|14:12/)
  })

  it('formats relative minutes from UTC', () => {
    const now = new Date('2026-07-10T01:12:00.000Z').getTime()
    const label = formatRelativeMinutes('2026-07-10T01:00:00.000Z', now)
    expect(label).toBe('hace 12 min')
  })
})
