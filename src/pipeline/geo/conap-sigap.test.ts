import { describe, expect, it } from 'vitest'
import {
  buildLogicalAreaKey,
  buildSourceFeatureId,
  normalizeTerritorialText,
  pickFeatureName,
  pickFeatureType,
} from '@/pipeline/geo/conap-sigap'

describe('conap-sigap identifiers', () => {
  it('normaliza texto con acentos', () => {
    expect(normalizeTerritorialText('Sierra de las Minas')).toBe('sierra de las minas')
  })

  it('genera logical_area_key determinístico', () => {
    const key = buildLogicalAreaKey({
      codigo_g_1: 150,
      codigo_e_2: 150,
      NOMBRE_G_1: 'Las Nubes',
      Categor_13: 'Reserva Natural Privada',
      NOMBRE_e_1: 'Las Nubes',
      Categor_14: 'Reserva Natural Privada',
    })
    expect(key).toBe('150|150|las nubes|las nubes')
  })

  it('genera source_feature_id único por geometría', () => {
    const logical = '150|150|las nubes|las nubes'
    const geomA: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    }
    const geomB: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [2, 0],
          [3, 0],
          [3, 1],
          [2, 0],
        ],
      ],
    }
    expect(buildSourceFeatureId(logical, geomA)).not.toBe(buildSourceFeatureId(logical, geomB))
  })

  it('prefiere nombre y categoría específicos', () => {
    expect(
      pickFeatureName({
        codigo_g_1: 1,
        codigo_e_2: 2,
        NOMBRE_G_1: 'General',
        Categor_13: 'Cat G',
        NOMBRE_e_1: 'Específica',
        Categor_14: 'Cat E',
      }),
    ).toBe('Específica')
    expect(
      pickFeatureType({
        codigo_g_1: 1,
        codigo_e_2: 2,
        NOMBRE_G_1: 'General',
        Categor_13: 'Cat G',
        NOMBRE_e_1: '',
        Categor_14: '',
      }),
    ).toBe('Cat G')
  })
})
