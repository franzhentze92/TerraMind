import { describe, expect, it } from 'vitest'
import {
  computeStaleStatus,
  computeWindowBounds,
  parseFireEventsQuery,
} from '@/modules/fires/api/fire-api.validation'

describe('parseFireEventsQuery', () => {
  it('accepts valid filters', () => {
    const result = parseFireEventsQuery(
      new URLSearchParams(
        'since=2026-07-01T00:00:00.000Z&risk_level=atencion&limit=25&offset=0',
      ),
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.risk_level).toBe('atencion')
      expect(result.data.limit).toBe(25)
    }
  })

  it('rejects limit greater than 100', () => {
    const result = parseFireEventsQuery(new URLSearchParams('limit=150'))
    expect(result.ok).toBe(false)
  })

  it('rejects invalid ISO date', () => {
    const result = parseFireEventsQuery(new URLSearchParams('since=not-a-date'))
    expect(result.ok).toBe(false)
  })

  it('rejects invalid risk_level enum', () => {
    const result = parseFireEventsQuery(new URLSearchParams('risk_level=emergencia'))
    expect(result.ok).toBe(false)
  })

  it('rejects negative offset', () => {
    const result = parseFireEventsQuery(new URLSearchParams('offset=-1'))
    expect(result.ok).toBe(false)
  })

  it('rejects min_priority above 100', () => {
    const result = parseFireEventsQuery(new URLSearchParams('min_priority=120'))
    expect(result.ok).toBe(false)
  })
})

describe('computeWindowBounds', () => {
  it('returns UTC ISO timestamps spanning requested hours', () => {
    const now = new Date('2026-07-10T01:00:00.000Z')
    const bounds = computeWindowBounds(48, now)
    expect(bounds.window_end_utc).toBe(now.toISOString())
    expect(bounds.window_start_utc).toBe('2026-07-08T01:00:00.000Z')
  })
})

describe('computeStaleStatus', () => {
  it('marks data stale after threshold', () => {
    const now = new Date('2026-07-10T04:00:00.000Z')
    const last = '2026-07-10T00:00:00.000Z'
    expect(computeStaleStatus(last, 180, now)).toBe(true)
  })

  it('marks data fresh within threshold', () => {
    const now = new Date('2026-07-10T01:30:00.000Z')
    const last = '2026-07-10T01:00:00.000Z'
    expect(computeStaleStatus(last, 180, now)).toBe(false)
  })

  it('treats missing ingestion as stale', () => {
    expect(computeStaleStatus(null, 180)).toBe(true)
  })
})
