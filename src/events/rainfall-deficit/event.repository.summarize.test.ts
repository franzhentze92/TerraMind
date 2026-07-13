/**
 * Ensures the rainfall-deficit repository exposes a `summarize()` snapshot.
 *
 * Without it, the type is silently dropped from the dashboard's enabled-type
 * list (`getEnvironmentalEventTypeSummaries` skips repos with no `summarize`),
 * so it would never appear even with its feature flag on and real data present.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/modules/precipitation/rainfall-deficit/rainfall-deficit.store', () => ({
  loadRainfallDeficitStore: vi.fn(),
}))

import { loadRainfallDeficitStore } from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.store'
import { rainfallDeficitRepository } from './event.repository'

const mockedLoad = vi.mocked(loadRainfallDeficitStore)

function storeWith(events: Array<{ status: string; createdAt: string }>) {
  return {
    version: 1,
    events,
    observations: [],
    cellConsecutivePentads: {},
    updatedAt: new Date().toISOString(),
  } as unknown as ReturnType<typeof loadRainfallDeficitStore>
}

describe('rainfallDeficitRepository.summarize', () => {
  beforeEach(() => {
    mockedLoad.mockReset()
  })

  it('returns a zeroed snapshot for an empty store (honest empty state)', async () => {
    mockedLoad.mockReturnValue(storeWith([]))
    const snap = await rainfallDeficitRepository.summarize(48)
    expect(snap).toEqual({ activeCount: 0, newCount: 0, status: 'current' })
  })

  it('counts active events and events created within the window', async () => {
    const now = Date.now()
    const recent = new Date(now - 2 * 60 * 60 * 1000).toISOString()
    const old = new Date(now - 100 * 60 * 60 * 1000).toISOString()
    mockedLoad.mockReturnValue(
      storeWith([
        { status: 'active', createdAt: recent },
        { status: 'active', createdAt: old },
        { status: 'resolved', createdAt: recent },
      ]),
    )
    const snap = await rainfallDeficitRepository.summarize(48)
    expect(snap.activeCount).toBe(2)
    expect(snap.newCount).toBe(2)
  })
})
