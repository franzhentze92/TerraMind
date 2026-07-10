import { describe, expect, it, vi } from 'vitest'

vi.mock('@/pipeline/stores/territorial.store', () => ({
  getFeaturesByIds: vi.fn(async (ids: string[]) =>
    ids.map((id) => ({
      id,
      name: 'Volcán Acatenango',
      feature_type: 'Parque Nacional',
      properties: {
        general_name: 'Parque Nacional',
        specific_name: 'Volcán Acatenango',
        display_name: 'Volcán Acatenango',
        general_category: 'Parque Nacional',
        specific_category: 'Parque Nacional',
      },
    })),
  ),
}))

import { buildProtectedAreaContextDto } from '@/modules/fires/utils/protected-area-context.dto'
import { buildTerritorySummaryText } from '@/modules/fires/utils/protected-area-summary'
import type { FireEventContextRow } from '@/pipeline/stores/territorial.store'

const baseContext: FireEventContextRow = {
  event_id: 'evt-1',
  context_version: 'abc123',
  inside_protected_area: false,
  detections_inside_protected_area_count: 0,
  detection_ids_inside_protected_area: [],
  protected_area_ids: [],
  protected_area_names: [],
  diagnostic_geometry_intersects_protected_area: false,
  nearest_protected_area_id: 'area-1',
  nearest_protected_area_name: 'Sierra de las Minas',
  nearest_protected_area_distance_m: 4800,
  protected_area_context_status: 'complete',
  source_versions: { gt_protected_areas: { version: 'SIGAP_08122025_IP' } },
  context_completeness: 1,
  generated_at: '2026-07-10T08:00:00.000Z',
}

describe('protected-area-context DTO', () => {
  it('no expone ids internos ni geometría', async () => {
    const dto = await buildProtectedAreaContextDto(baseContext)
    expect(dto).not.toBeNull()
    expect(JSON.stringify(dto)).not.toContain('detection_ids')
    expect(dto?.nearest_area?.display_name).toBe('Volcán Acatenango')
    expect(dto?.nearest_area).not.toHaveProperty('id')
  })

  it('resume evento fuera con área cercana', async () => {
    const dto = await buildProtectedAreaContextDto(baseContext)
    const text = buildTerritorySummaryText(dto!)
    expect(text).toContain('no intersecta')
    expect(text).toContain('4.8 km')
  })

  it('resume evento dentro', async () => {
    const inside: FireEventContextRow = {
      ...baseContext,
      inside_protected_area: true,
      detections_inside_protected_area_count: 1,
      protected_area_ids: ['area-2'],
      protected_area_names: ['Parque Nacional'],
      nearest_protected_area_distance_m: 0,
    }
    const dto = await buildProtectedAreaContextDto(inside)
    expect(dto?.intersecting_areas[0]?.display_name).toBe('Volcán Acatenango')
    expect(buildTerritorySummaryText(dto!)).toContain('revisión territorial prioritaria')
  })
})
