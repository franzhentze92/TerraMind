/**
 * Adapter-level parity: the "Eventos activos" KPI (summarize) and the map list
 * must describe the SAME set of thermal events for the same window.
 *
 * Root cause of the "KPI 13 / map 0" bug: `summarize()` counts events in the
 * window regardless of fire `status`, while the map used to filter
 * `status: 'active'` (a much narrower set). The fix drops that status filter and
 * feeds the list the same `since` window. This test locks that in by stubbing
 * the two underlying services and checking counts line up.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FireEventListItemDto, FireSummaryDto } from '@/modules/fires/types/fire.dto'

const listFireEventsMock = vi.fn()
const getFireSummaryMock = vi.fn()

vi.mock('../fire-events.service.js', () => ({
  listFireEvents: (...args: unknown[]) => listFireEventsMock(...args),
}))
vi.mock('../fire-summary.service.js', () => ({
  getFireSummary: (...args: unknown[]) => getFireSummaryMock(...args),
}))
// Detail/relations helpers are not exercised here but are imported by the adapter.
vi.mock('../fire-event-detail.service.js', () => ({ getFireEventDetail: vi.fn() }))
vi.mock('../findings.service.js', () => ({ getFindingsForFireEvent: vi.fn() }))
vi.mock('../priorities.service.js', () => ({ getPriorityForFireEvent: vi.fn() }))
vi.mock('../incidents.service.js', () => ({ getFireEventIncident: vi.fn() }))

import { ThermalEventRepositoryAdapter } from './thermal-event-repository.adapter'

function fireEvent(i: number, status: FireEventListItemDto['status']): FireEventListItemDto {
  return {
    id: `evt-${i}`,
    department_code: 'GT01',
    department_name: 'Petén',
    status,
    validation_status: 'confirmado',
    risk_level: 'alto',
    priority_score: 50,
    centroid_lat: 15.5 + i * 0.01,
    centroid_lng: -90.5 - i * 0.01,
    first_detected_at: '2026-07-09T06:00:00.000Z',
    last_detected_at: '2026-07-10T20:00:00.000Z',
    persistence_hours: 5,
    detection_count: 3,
    satellite_count: 2,
    source_products: ['VIIRS_SNPP_NRT'],
    max_frp_mw: 10,
    geometry_method: 'convex_hull_buffer',
    cross_department: false,
    created_at: '2026-07-09T06:05:00.000Z',
  }
}

describe('thermal adapter — summary/list window parity', () => {
  const adapter = new ThermalEventRepositoryAdapter()

  beforeEach(() => {
    listFireEventsMock.mockReset()
    getFireSummaryMock.mockReset()
  })

  it('summary activeCount equals the windowed list length (any status)', async () => {
    // 13 events in the window: a MIX of statuses (only some are `active`).
    const statuses: FireEventListItemDto['status'][] = [
      'active',
      'active',
      'monitoring',
      'monitoring',
      'new',
      'new',
      'new',
      'closed',
      'active',
      'monitoring',
      'new',
      'active',
      'monitoring',
    ]
    const events = statuses.map((s, i) => fireEvent(i, s))

    // getFireSummary counts every event in the window (events_count === 13).
    getFireSummaryMock.mockResolvedValue({
      events_count: events.length,
      active_events_count: events.filter((e) => e.status === 'active').length,
      data_status: { is_stale: false },
    } as unknown as FireSummaryDto)

    // The windowed list (no status filter) returns the SAME 13 events.
    listFireEventsMock.mockResolvedValue({
      items: events,
      pagination: { limit: 100, offset: 0, total: events.length },
      generated_at: new Date().toISOString(),
    })

    const summary = await adapter.summarize(48)
    const page = await adapter.list({
      type: 'thermal_activity',
      since: '2026-07-08T20:00:00.000Z',
      limit: 100,
    })

    expect(summary.activeCount).toBe(13)
    expect(page.items).toHaveLength(13)
    expect(summary.activeCount).toBe(page.items.length)

    // And the list was NOT narrowed by a fire status filter.
    const fireQuery = listFireEventsMock.mock.calls[0][0] as { status?: string }
    expect(fireQuery.status).toBeUndefined()
  })
})
