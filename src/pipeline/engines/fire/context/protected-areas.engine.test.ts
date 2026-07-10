import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'
import { buildContextVersion } from '@/pipeline/geo/conap-sigap'

const enrichMock = vi.fn()
const getLayerMock = vi.fn()
const countMock = vi.fn()

const artifactHash = createHash('sha256').update('SIGAP_08122025_IP|405').digest('hex').slice(0, 16)
const CURRENT_VERSION = buildContextVersion('SIGAP_08122025_IP', 405, artifactHash)

vi.mock('@/pipeline/stores/territorial.store', () => ({
  getTerritorialLayer: (...args: unknown[]) => getLayerMock(...args),
  countTerritorialFeatures: (...args: unknown[]) => countMock(...args),
  enrichEventProtectedAreaContext: (...args: unknown[]) => enrichMock(...args),
}))

vi.mock('@/pipeline/stores/supabase.client', () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        order: () => ({
          limit: async () => ({
            data: [
              {
                id: 'evt-1',
                detection_count: 1,
                geo_departments: { name: 'Petén' },
                fire_event_context: {
                  context_version: CURRENT_VERSION,
                  generated_at: '2026-07-10T08:00:00.000Z',
                },
                fire_event_detections: [{ linked_at: '2026-07-10T07:00:00.000Z' }],
              },
            ],
            error: null,
          }),
        }),
      }),
    }),
  }),
}))

import { runProtectedAreasEnrichment } from '@/pipeline/engines/fire/context/protected-areas.engine'

describe('protected-areas engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getLayerMock.mockResolvedValue({
      source_version: 'SIGAP_08122025_IP',
      source_date: '2025-12-08',
    })
    countMock.mockResolvedValue(405)
  })

  it('deja eventos sin cambios cuando el contexto está vigente', async () => {
    const metrics = await runProtectedAreasEnrichment({ limit: 10, force: false })
    expect(metrics.events_considered).toBe(1)
    expect(metrics.events_enriched).toBe(0)
    expect(metrics.events_unchanged).toBe(1)
    expect(enrichMock).not.toHaveBeenCalled()
  })

  it('enriquece con --force', async () => {
    enrichMock.mockResolvedValue({
      inside_protected_area: true,
      detections_inside_protected_area_count: 1,
      nearest_protected_area_name: 'Volcán Acatenango',
      nearest_protected_area_distance_m: 0,
      diagnostic_geometry_intersects_protected_area: true,
      protected_area_context_status: 'complete',
    })

    const metrics = await runProtectedAreasEnrichment({ limit: 10, force: true })
    expect(metrics.events_enriched).toBe(1)
    expect(metrics.inside_protected_area_count).toBe(1)
  })
})
