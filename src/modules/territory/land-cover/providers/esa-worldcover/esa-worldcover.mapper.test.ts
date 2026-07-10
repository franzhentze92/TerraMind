import { describe, expect, it } from 'vitest'
import {
  ESA_WORLDCOVER_V200_CLASSES,
  mapEsaWorldCoverCode,
} from '@/modules/territory/land-cover/providers/esa-worldcover/esa-worldcover.mapper'

describe('esa-worldcover.mapper', () => {
  it('mapea las 11 clases WorldCover v200', () => {
    expect(ESA_WORLDCOVER_V200_CLASSES).toHaveLength(11)
    expect(mapEsaWorldCoverCode(95).internal_class).toBe('mangrove')
    expect(mapEsaWorldCoverCode(90).internal_class).toBe('herbaceous_wetland')
  })

  it('mantiene manglar separado de humedal herbáceo', () => {
    expect(mapEsaWorldCoverCode(95).internal_class).not.toBe('herbaceous_wetland')
  })

  it('desconocido → unknown', () => {
    expect(mapEsaWorldCoverCode(0).internal_class).toBe('unknown')
    expect(mapEsaWorldCoverCode(255).internal_class).toBe('unknown')
  })
})
