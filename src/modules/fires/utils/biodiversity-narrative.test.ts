import { describe, expect, it } from 'vitest'

import {
  buildBiodiversityEventNarrative,
  containsAffectedSpeciesLanguage,
} from '@/modules/fires/utils/biodiversity-narrative'
import type { BiodiversityContextDto } from '@/modules/fires/types/fire.dto'

function sampleContext(): BiodiversityContextDto {
  return {
    status: 'partial',
    generated_at: new Date().toISOString(),
    context_version: 'abc',
    geometry_source: 'detections_union',
    history_window: { years: 5 },
    recent_window: { days: 30 },
    summary: {
      unique_species_documented: 186,
      observations_documented: 220,
      observations_recent_30d: 12,
      observations_recent_90d: 40,
      provider_distribution: { gbif: 100, inaturalist: 120 },
      taxa_distribution: { birds: 50, plants: 80 },
      quality: { level: 'moderate', reasons: [] },
    },
    zones: [
      {
        radius_m: 10_000,
        unique_species_documented: 186,
        observations_documented: 220,
        observations_recent_30d: 12,
        observations_recent_90d: 40,
        event_window_observations: 3,
        gbif_count: 100,
        inaturalist_count: 120,
        research_grade_inaturalist: 40,
        generalized_count: 5,
        obscured_count: 2,
        spatially_excluded_count: 8,
        duplicated_count: 4,
        media_usable_count: 20,
        latest_observation_at: null,
        taxa_distribution: {},
        truncated: false,
        quality: {},
        warnings: [],
      },
    ],
    monitored_zone_context: {
      relation: 'inside',
      zone_name: 'Reserva de la Biosfera Maya',
      zone_code: 'maya',
      distance_m: 1000,
    },
    visual_highlights: [],
    provider_status: { gbif: 'ok', inaturalist: 'ok' },
    warnings: [],
    disclaimer: 'disclaimer',
  }
}

describe('biodiversity-narrative', () => {
  it('uses documented language', () => {
    const text = buildBiodiversityEventNarrative(sampleContext())
    expect(text).toContain('documentado')
    expect(text).not.toMatch(/afectad/i)
  })

  it('flags forbidden affected-species language', () => {
    expect(containsAffectedSpeciesLanguage('186 especies afectadas')).toBe(true)
    expect(containsAffectedSpeciesLanguage('186 especies documentadas')).toBe(false)
  })
})
