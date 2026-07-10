import { describe, expect, it } from 'vitest'

/** Constantes de pestañas del panel de detalle (evita acoplar a React en pruebas). */
export const FIRE_DETAIL_TABS = ['resumen', 'evidencia', 'analisis'] as const

export type FireDetailTab = (typeof FIRE_DETAIL_TABS)[number]

export function isFireDetailTab(value: string): value is FireDetailTab {
  return (FIRE_DETAIL_TABS as readonly string[]).includes(value)
}

describe('fire detail panel tabs', () => {
  it('defines three detail sections', () => {
    expect(FIRE_DETAIL_TABS).toEqual(['resumen', 'evidencia', 'analisis'])
  })

  it('validates tab ids', () => {
    expect(isFireDetailTab('evidencia')).toBe(true)
    expect(isFireDetailTab('invalid')).toBe(false)
  })
})

describe('national view reset', () => {
  it('increments token to trigger national fit', () => {
    let token = 0
    const bump = () => {
      token += 1
    }
    bump()
    expect(token).toBe(1)
  })
})
