import { describe, expect, it } from 'vitest'

import { buildBiodiversityContextDto } from './biodiversity-context.dto'
import type { BiodiversityContextRow } from '@/pipeline/stores/biodiversity-event.store'

describe('biodiversity-context.dto', () => {
  it('does not expose coordinates in DTO', () => {
    const row = {
      id: 'ctx-1',
      entity_type: 'fire_event',
      entity_id: 'evt-1',
      context_version: 'v1',
      status: 'complete',
      geometry_source: 'detections_union',
      event_time: null,
      history_start: null,
      history_end: null,
      provider_status: { gbif: 'ok', inaturalist: 'ok' },
      summary: {
        unique_species_documented: 10,
        observations_documented: 12,
        observations_recent_30d: 2,
        observations_recent_90d: 4,
        provider_distribution: { gbif: 5, inaturalist: 7 },
        taxa_distribution: { birds: 3 },
        quality: { level: 'moderate', reasons: [] },
      },
      quality: { level: 'moderate', reasons: [] },
      monitored_zone_context: { primary: { relation: 'near', name: 'Test', zone_code: 'x' } },
      warnings: [],
      generated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as BiodiversityContextRow

    const dto = buildBiodiversityContextDto(row, [], [])
    expect(dto).not.toBeNull()
    expect(JSON.stringify(dto)).not.toMatch(/latitude|longitude|decimal/)
    expect(dto?.disclaimer).toContain('documentada')
  })

  it('omits failed provider counts from distribution', () => {
    const row = {
      id: 'ctx-2',
      entity_type: 'fire_event',
      entity_id: 'evt-2',
      context_version: 'v1',
      status: 'partial',
      geometry_source: 'detections_union',
      event_time: null,
      history_start: null,
      history_end: null,
      provider_status: { gbif: 'ok', inaturalist: 'error' },
      summary: {
        unique_species_documented: 3,
        observations_documented: 3,
        observations_recent_30d: 0,
        observations_recent_90d: 0,
        provider_distribution: { gbif: 3, inaturalist: 0 },
        taxa_distribution: {},
        quality: { level: 'limited', reasons: ['provider_partial'] },
      },
      quality: { level: 'limited', reasons: ['provider_partial'] },
      monitored_zone_context: {},
      warnings: ['provider_unavailable'],
      generated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as BiodiversityContextRow

    const dto = buildBiodiversityContextDto(
      row,
      [
        {
          id: 'z1',
          context_id: 'ctx-2',
          radius_m: 10_000,
          unique_species_documented: 3,
          observations_documented: 3,
          observations_recent_30d: 0,
          observations_recent_90d: 0,
          event_window_observations: 0,
          gbif_count: 3,
          inaturalist_count: 0,
          research_grade_inaturalist: 0,
          generalized_count: 0,
          obscured_count: 0,
          spatially_excluded_count: 0,
          duplicated_count: 0,
          media_usable_count: 0,
          latest_observation_at: null,
          taxa_distribution: {},
          data_quality: {},
          truncated: false,
          warnings: [],
          generated_at: new Date().toISOString(),
        },
      ],
      [],
    )

    expect(dto?.summary.provider_distribution.gbif).toBe(3)
    expect(dto?.summary.provider_distribution.inaturalist).toBeUndefined()
  })
})
