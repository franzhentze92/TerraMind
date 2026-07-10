import { describe, expect, it } from 'vitest'
import { attributesEqual } from '@/pipeline/geo/sigap-duplicate-audit'
import type { ConapSigapAttributes } from '@/pipeline/geo/conap-sigap'

const base: ConapSigapAttributes = {
  codigo_g_1: 150,
  codigo_e_2: 150,
  NOMBRE_G_1: 'Las Nubes',
  Categor_13: 'Reserva Natural Privada',
  NOMBRE_e_1: 'Las Nubes',
  Categor_14: 'Reserva Natural Privada',
}

describe('sigap duplicate audit', () => {
  it('considera iguales registros con mismos atributos relevantes', () => {
    expect(attributesEqual(base, { ...base })).toBe(true)
  })

  it('detecta diferencia material en categoría', () => {
    expect(
      attributesEqual(base, {
        ...base,
        Categor_14: 'Parque Nacional',
      }),
    ).toBe(false)
  })
})
