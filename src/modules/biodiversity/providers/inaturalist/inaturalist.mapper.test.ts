import { describe, expect, it } from 'vitest'
import {
  decodeInatCursor,
  encodeInatCursor,
  mapInaturalistObservation,
  mapInaturalistTaxon,
} from './inaturalist.mapper'
import type { InatObservation } from './inaturalist.types'

describe('inaturalist.mapper', () => {
  it('maps obscured observation with privacy policy', () => {
    const obs: InatObservation = {
      id: 42,
      observed_on: '2024-03-10',
      quality_grade: 'research',
      latitude: 14.5012,
      longitude: -90.8765,
      obscured: true,
      geoprivacy: 'obscured',
      license_code: 'cc-by',
      taxon: { id: 1, name: 'Oreortyx pictus', rank: 'species' },
      uri: 'https://www.inaturalist.org/observations/42',
    }
    const mapped = mapInaturalistObservation(obs, '2026-01-01T00:00:00.000Z')
    expect(mapped.coordinatesObscured).toBe(true)
    expect(mapped.privacyLevel).toBe('sensitive_generalized')
    expect(mapped.license).toBe('CC-BY-4.0')
  })

  it('flags captive cultivated', () => {
    const obs: InatObservation = {
      id: 7,
      captive: true,
      taxon: { id: 2, name: 'Ara macao' },
    }
    const mapped = mapInaturalistObservation(obs, '2026-01-01T00:00:00.000Z')
    expect(mapped.captiveOrCultivated).toBe(true)
  })

  it('maps taxon', () => {
    const taxon = mapInaturalistTaxon(
      { id: 123, name: 'Quetzal', preferred_common_name: 'Quetzal' },
      '2026-01-01T00:00:00.000Z',
    )
    expect(taxon.sourceTaxonId).toBe('123')
  })

  it('encodes cursor pages', () => {
    expect(decodeInatCursor(encodeInatCursor(3))).toBe(3)
  })
})
