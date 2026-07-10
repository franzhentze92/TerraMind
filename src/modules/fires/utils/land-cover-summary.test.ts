import { describe, expect, it } from 'vitest'
import {
  buildLandCoverContextDto,
} from '@/modules/fires/utils/land-cover-context.dto'
import {
  buildLandCoverMapSnippet,
  buildLandCoverNarrative,
  landCoverUiStateMessage,
  resolveLandCoverUiState,
} from '@/modules/fires/utils/land-cover-summary'
import type { LandCoverContextRow, LandCoverZoneRow } from '@/pipeline/stores/land-cover.store'

function makeDto(
  pointClasses: Array<{ class: string; count: number; pct: number }>,
  zone1kmPct: number,
  zone1kmClass = 'grassland',
  mixed = false,
) {
  const context: LandCoverContextRow = {
    event_id: 'evt',
    context_version: 'v1',
    source_layer_id: null,
    source_version: '2021-v200',
    reference_year: 2021,
    point_distribution: {
      dominant_class: mixed ? null : pointClasses[0]?.class,
      class_distribution: pointClasses.map((row) => ({
        internal_class: row.class,
        count: row.count,
        pct: row.pct,
      })),
    },
    status: 'complete',
    warnings: mixed ? ['mixed_point_classes'] : [],
    generated_at: '2026-07-10T10:00:00.000Z',
    updated_at: '2026-07-10T10:00:00.000Z',
  }
  const zone: LandCoverZoneRow = {
    id: 'z1',
    event_id: 'evt',
    radius_m: 1000,
    context_version: 'v1',
    dominant_class: zone1kmClass,
    class_distribution: {
      classes: [{ internal_class: zone1kmClass, pct: zone1kmPct, count: 100 }],
    },
    herbaceous_wetland_pct: null,
    mangrove_pct: null,
    forest_pct: null,
    cropland_pct: null,
    built_up_pct: null,
    permanent_water_pct: null,
    valid_pixel_count: 100,
    nodata_pixel_count: 0,
    data_coverage_pct: 100,
    analyzed_area_ha: 300,
    generated_at: '2026-07-10T10:00:00.000Z',
  }
  return buildLandCoverContextDto(context, [zone])!
}

describe('land-cover narrative', () => {
  it('punto igual al entorno', () => {
    const dto = makeDto([{ class: 'grassland', count: 3, pct: 100 }], 72.4)
    const text = buildLandCoverNarrative(dto.point_evidence, dto.zones[0])
    expect(text).toContain('pastizal')
    expect(text).toContain('también está dominado')
    expect(text).not.toContain('confirmad')
  })

  it('punto diferente al entorno (Petén / Jutiapa)', () => {
    const dto = makeDto([{ class: 'forest', count: 2, pct: 100 }], 61, 'grassland')
    const text = buildLandCoverNarrative(dto.point_evidence, dto.zones[0])
    expect(text).toContain('bosque')
    expect(text).toContain('pastizal')
    expect(text).toContain('mientras que')
  })

  it('punto bare_sparse con entorno grassland', () => {
    const dto = makeDto([{ class: 'bare_sparse', count: 2, pct: 100 }], 55, 'grassland')
    const text = buildLandCoverNarrative(dto.point_evidence, dto.zones[0])
    expect(text).toContain('suelo desnudo')
    expect(text).toContain('pastizal')
  })

  it('punto mixto Escuintla', () => {
    const dto = makeDto(
      [
        { class: 'forest', count: 2, pct: 66.7 },
        { class: 'grassland', count: 1, pct: 33.3 },
      ],
      70,
      'grassland',
      true,
    )
    const text = buildLandCoverNarrative(dto.point_evidence, dto.zones[0])
    expect(text).toContain('combinación')
    expect(text).toContain('Bosque')
    expect(text).toContain('Pastizal')
  })

  it('no afirma incendio forestal ni daño', () => {
    const dto = makeDto([{ class: 'forest', count: 1, pct: 100 }], 90, 'forest')
    const text = buildLandCoverNarrative(dto.point_evidence, dto.zones[0])
    expect(text).not.toMatch(/incendio forestal|quema agrícola|deforestación|área quemada|daño/i)
  })
})

describe('land-cover UI states', () => {
  it('unavailable sin contexto', () => {
    expect(resolveLandCoverUiState({ context: null })).toBe('unavailable')
    expect(landCoverUiStateMessage('unavailable')).toContain('aún no calculado')
  })

  it('loading', () => {
    expect(resolveLandCoverUiState({ isLoading: true, context: null })).toBe('loading')
  })

  it('missing_zone si falta radio esperado', () => {
    const dto = makeDto([{ class: 'grassland', count: 1, pct: 100 }], 80)
    dto.zones = dto.zones.filter((z) => z.radius_m !== 500)
    expect(resolveLandCoverUiState({ context: dto })).toBe('missing_zone')
  })

  it('snippet de mapa con punto y entorno', () => {
    const dto = makeDto([{ class: 'forest', count: 1, pct: 100 }], 61, 'grassland')
    const snippet = buildLandCoverMapSnippet(dto)
    expect(snippet).toContain('Cobertura en detecciones: Bosque')
    expect(snippet).toContain('Entorno 1 km: Pastizal 61%')
  })
})
