import { describe, expect, it } from 'vitest'
import type { EnvironmentalEvent } from '@/modules/environmental-events/types/environmental-event.types'
import { pickAutoSelectEvent } from './auto-select-event'

function ev(
  id: string,
  opts: { severity?: number; lastObservedAt?: string; persistence?: number } = {},
): EnvironmentalEvent {
  return {
    id,
    severity: opts.severity,
    persistence: opts.persistence,
    lastObservedAt: opts.lastObservedAt ?? '2024-01-01T00:00:00.000Z',
  } as unknown as EnvironmentalEvent
}

describe('pickAutoSelectEvent', () => {
  it('returns undefined for an empty list (honest empty state)', () => {
    expect(pickAutoSelectEvent([])).toBeUndefined()
  })

  it('prefers the highest operational priority (severity)', () => {
    const best = pickAutoSelectEvent([
      ev('low', { severity: 0.2, lastObservedAt: '2025-01-01T00:00:00.000Z' }),
      ev('high', { severity: 0.9, lastObservedAt: '2020-01-01T00:00:00.000Z' }),
    ])
    expect(best?.id).toBe('high')
  })

  it('falls back to the most recent when no severity', () => {
    const best = pickAutoSelectEvent([
      ev('old', { lastObservedAt: '2020-01-01T00:00:00.000Z' }),
      ev('new', { lastObservedAt: '2025-06-01T00:00:00.000Z' }),
    ])
    expect(best?.id).toBe('new')
  })

  it('falls back to the most persistent, then a stable id', () => {
    const sameTime = '2025-01-01T00:00:00.000Z'
    const byPersistence = pickAutoSelectEvent([
      ev('a', { lastObservedAt: sameTime, persistence: 1 }),
      ev('b', { lastObservedAt: sameTime, persistence: 5 }),
    ])
    expect(byPersistence?.id).toBe('b')

    const stable = pickAutoSelectEvent([
      ev('zeta', { lastObservedAt: sameTime }),
      ev('alpha', { lastObservedAt: sameTime }),
    ])
    expect(stable?.id).toBe('alpha')
  })

  it('is deterministic regardless of input order', () => {
    const a = ev('a', { severity: 0.5, lastObservedAt: '2025-01-01T00:00:00.000Z' })
    const b = ev('b', { severity: 0.5, lastObservedAt: '2025-02-01T00:00:00.000Z' })
    expect(pickAutoSelectEvent([a, b])?.id).toBe('b')
    expect(pickAutoSelectEvent([b, a])?.id).toBe('b')
  })
})
