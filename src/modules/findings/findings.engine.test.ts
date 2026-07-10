import { describe, expect, it } from 'vitest'

import { containsForbiddenFindingCopy } from './findings-copy-guard'
import { buildFindingsContextVersion } from './findings-context-version'
import {
  evaluateDocumentedBiodiversity,
  evaluateThermalInProtectedArea,
  evaluateThermalOnForestCover,
} from './rules/fire-finding-rules'
import type { FireFindingEvaluationContext } from './services/fire-finding-context.loader'

function baseContext(
  overrides: Partial<FireFindingEvaluationContext> = {},
): FireFindingEvaluationContext {
  return {
    event: {
      id: 'evt-1',
      department_code: 'GT01',
      department_name: 'Petén',
      status: 'active',
      validation_status: 'pending',
      detection_count: 3,
      first_detected_at: '2026-01-01T00:00:00Z',
      last_detected_at: '2026-01-02T00:00:00Z',
      centroid_lat: 17.2,
      centroid_lng: -89.6,
    },
    protected_area: null,
    land_cover: null,
    population: null,
    climate: null,
    biodiversity: null,
    availability: {
      protected_area: 'missing',
      land_cover: 'missing',
      population: 'missing',
      climate: 'missing',
      biodiversity: 'missing',
    },
    context_versions: {
      fire_event: '3:2026-01-02:pending',
      protected_area: null,
      land_cover: null,
      population: null,
      climate: null,
      biodiversity: null,
      composite: 'abc',
      rule_set: '1.0.0',
    },
    ...overrides,
  }
}

describe('fire-finding-rules', () => {
  it('triggers protected area finding when inside', () => {
    const result = evaluateThermalInProtectedArea(
      baseContext({
        protected_area: {
          status: 'complete',
          inside_protected_area: true,
          detections_inside_count: 2,
          intersecting_areas: [{ display_name: 'Reserva Maya', general_name: null, specific_name: null, feature_type: null }],
          nearest_area: null,
          diagnostic_geometry_intersects_protected_area: true,
          source_name: 'CONAP',
          source_version: 'v1',
          generated_at: '2026-01-01',
        },
        availability: { ...baseContext().availability, protected_area: 'complete' },
      }),
    )
    expect(result.status).toBe('triggered')
    expect(result.summary).toContain('área protegida')
    expect(containsForbiddenFindingCopy(result.summary)).toBe(false)
  })

  it('is not evaluable without protected area context', () => {
    const result = evaluateThermalInProtectedArea(baseContext())
    expect(result.status).toBe('not_evaluable')
  })

  it('triggers forest cover finding', () => {
    const result = evaluateThermalOnForestCover(
      baseContext({
        land_cover: {
          status: 'complete',
          source: { name: 'ESA', version: '2021', year: 2021, resolution_m: 10 },
          generated_at: '2026-01-01',
          context_version: 'lc1',
          point_evidence: { detections_sampled: 2, dominant_class: 'forest', mixed: false, class_distribution: [] },
          zones: [
            {
              radius_m: 1000,
              dominant_class: 'forest',
              dominant_label: 'Bosque',
              class_distribution: [{ class: 'forest', label: 'Bosque', percentage: 80, area_ha: 10 }],
              valid_pixel_count: 100,
              data_coverage_pct: 95,
              analyzed_area_ha: 10,
            },
          ],
          warnings: [],
          disclaimer: 'test',
        },
        availability: { ...baseContext().availability, land_cover: 'complete' },
      }),
    )
    expect(result.status).toBe('triggered')
    expect(result.evidence[0]?.context_path).toContain('land_cover')
  })

  it('mentions iNaturalist unavailable not zero observations', () => {
    const result = evaluateDocumentedBiodiversity(
      baseContext({
        biodiversity: {
          status: 'partial',
          generated_at: '2026-01-01',
          context_version: 'b1',
          geometry_source: 'detections_union',
          history_window: { years: 5 },
          recent_window: { days: 30 },
          summary: {
            unique_species_documented: 5,
            observations_documented: 8,
            observations_recent_30d: 0,
            observations_recent_90d: 0,
            provider_distribution: { gbif: 8 },
            taxa_distribution: { birds: 3 },
            quality: { level: 'moderate', reasons: [] },
          },
          zones: [
            {
              radius_m: 10_000,
              unique_species_documented: 5,
              observations_documented: 8,
              observations_recent_30d: 0,
              observations_recent_90d: 0,
              event_window_observations: 0,
              gbif_count: 8,
              inaturalist_count: 0,
              research_grade_inaturalist: 0,
              generalized_count: 0,
              obscured_count: 0,
              spatially_excluded_count: 0,
              duplicated_count: 0,
              media_usable_count: 2,
              latest_observation_at: null,
              taxa_distribution: {},
              truncated: false,
              quality: {},
              warnings: [],
            },
          ],
          monitored_zone_context: { relation: 'outside', zone_name: null, zone_code: null, distance_m: null },
          visual_highlights: [],
          provider_status: { gbif: 'ok', inaturalist: 'error' },
          warnings: [],
          disclaimer: 'test',
        },
        availability: { ...baseContext().availability, biodiversity: 'partial' },
      }),
    )
    expect(result.status).toBe('triggered')
    expect(result.limitations.some((l) => l.includes('iNaturalist no estuvo disponible'))).toBe(true)
    expect(containsForbiddenFindingCopy('no hay observaciones de inaturalist')).toBe(true)
  })
})

describe('findings-context-version', () => {
  it('is deterministic', () => {
    const a = buildFindingsContextVersion({ ruleSetVersion: '1.0.0', landCoverVersion: 'x' })
    const b = buildFindingsContextVersion({ ruleSetVersion: '1.0.0', landCoverVersion: 'x' })
    expect(a).toBe(b)
  })
})
