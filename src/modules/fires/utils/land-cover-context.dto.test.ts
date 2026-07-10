import { describe, expect, it } from 'vitest'
import {
  assertLandCoverDtoSafe,
  buildLandCoverContextDto,
  LAND_COVER_SENSITIVE_KEYS,
} from '@/modules/fires/utils/land-cover-context.dto'
import type { LandCoverContextRow, LandCoverZoneRow } from '@/pipeline/stores/land-cover.store'
import { LAND_COVER_API_DISCLAIMER } from '@/modules/territory/land-cover/land-cover-taxonomy'

const baseContext: LandCoverContextRow = {
  event_id: 'evt-1',
  context_version: 'd17f6bd31df93ec7',
  source_layer_id: 'layer-internal-uuid',
  source_version: '2021-v200',
  reference_year: 2021,
  point_distribution: {
    dominant_class: 'grassland',
    class_distribution: [
      { internal_class: 'grassland', provider_class_code: 40, count: 3, pct: 100 },
    ],
    valid_pixel_count: 3,
    nodata_pixel_count: 0,
    data_coverage_pct: 100,
    samples: [{ latitude: 14.5, longitude: -91.2, internal_class: 'grassland' }],
  },
  status: 'complete',
  warnings: ['outdated_source_year'],
  generated_at: '2026-07-10T10:00:00.000Z',
  updated_at: '2026-07-10T10:00:00.000Z',
}

const zone500: LandCoverZoneRow = {
  id: 'zone-500',
  event_id: 'evt-1',
  radius_m: 500,
  context_version: 'd17f6bd31df93ec7',
  dominant_class: 'grassland',
  class_distribution: {
    dominant_class: 'grassland',
    classes: [
      { internal_class: 'grassland', provider_class_code: 40, count: 800, pct: 72.4 },
      { internal_class: 'forest', provider_class_code: 10, count: 200, pct: 18 },
      { internal_class: 'cropland', provider_class_code: 40, count: 80, pct: 7 },
      { internal_class: 'shrubland', provider_class_code: 20, count: 30, pct: 3 },
    ],
  },
  herbaceous_wetland_pct: null,
  mangrove_pct: null,
  forest_pct: 18,
  cropland_pct: 7,
  built_up_pct: null,
  permanent_water_pct: null,
  valid_pixel_count: 1110,
  nodata_pixel_count: 0,
  data_coverage_pct: 100,
  analyzed_area_ha: 78.5,
  generated_at: '2026-07-10T10:00:00.000Z',
}

const zone1000: LandCoverZoneRow = {
  ...zone500,
  id: 'zone-1000',
  radius_m: 1000,
  class_distribution: {
    dominant_class: 'grassland',
    classes: [{ internal_class: 'grassland', provider_class_code: 40, count: 1200, pct: 61 }],
  },
  analyzed_area_ha: 314.2,
}

describe('land-cover-context DTO', () => {
  it('devuelve null sin fila de contexto', () => {
    expect(buildLandCoverContextDto(null, [])).toBeNull()
  })

  it('mapea contexto completo con zonas ordenadas', () => {
    const dto = buildLandCoverContextDto(baseContext, [zone1000, zone500])
    expect(dto).not.toBeNull()
    expect(dto!.zones.map((z) => z.radius_m)).toEqual([500, 1000])
    expect(dto!.point_evidence.detections_sampled).toBe(3)
    expect(dto!.point_evidence.class_distribution[0].label).toBe('Pastizal')
    expect(dto!.zones[0].dominant_label).toBe('Pastizal')
    expect(dto!.zones[0].class_distribution[0].area_ha).toBeCloseTo(56.8, 0)
    expect(dto!.disclaimer).toBe(LAND_COVER_API_DISCLAIMER)
    expect(dto!.disclaimer).toContain('2021')
  })

  it('marca punto mixto y distribución por detección', () => {
    const mixed: LandCoverContextRow = {
      ...baseContext,
      point_distribution: {
        dominant_class: 'forest',
        class_distribution: [
          { internal_class: 'forest', count: 2, pct: 66.7 },
          { internal_class: 'grassland', count: 1, pct: 33.3 },
        ],
      },
      warnings: ['mixed_point_classes'],
    }
    const dto = buildLandCoverContextDto(mixed, [zone500])
    expect(dto!.point_evidence.mixed).toBe(true)
    expect(dto!.point_evidence.dominant_class).toBeNull()
    expect(dto!.point_evidence.class_distribution).toHaveLength(2)
  })

  it('maneja contexto parcial con zona faltante', () => {
    const partial: LandCoverContextRow = { ...baseContext, status: 'partial' }
    const dto = buildLandCoverContextDto(partial, [zone500])
    expect(dto!.status).toBe('partial')
    expect(dto!.zones).toHaveLength(1)
  })

  it('no expone paths, geometrías ni ids internos', () => {
    const dto = buildLandCoverContextDto(baseContext, [zone500, zone1000])!
    const json = JSON.stringify(dto)
    expect(json).not.toContain('source_layer_id')
    expect(json).not.toContain('layer-internal-uuid')
    expect(json).not.toContain('samples')
    expect(json).not.toContain('provider_class_code')
    expect(json).not.toContain('latitude')
    expect(json).not.toContain('longitude')
    expect(json).not.toContain('.tif')
    expect(json).not.toContain('gdal')
    assertLandCoverDtoSafe(dto)
    for (const key of LAND_COVER_SENSITIVE_KEYS) {
      expect(json.toLowerCase()).not.toContain(key)
    }
  })

  it('usa etiquetas humanas de taxonomía', () => {
    const forestPoint: LandCoverContextRow = {
      ...baseContext,
      point_distribution: {
        dominant_class: 'bare_sparse',
        class_distribution: [{ internal_class: 'bare_sparse', count: 2, pct: 100 }],
      },
    }
    const dto = buildLandCoverContextDto(forestPoint, [zone500])!
    expect(dto.point_evidence.class_distribution[0].label).toBe(
      'Suelo desnudo o vegetación escasa',
    )
  })
})
