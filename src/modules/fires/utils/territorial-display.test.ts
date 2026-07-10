import { describe, expect, it } from 'vitest'
import {
  buildTerritorialDisplayName,
  isGenericTerritorialName,
} from '@/modules/fires/utils/territorial-display'

describe('territorial-display', () => {
  it('detecta etiquetas genéricas', () => {
    expect(isGenericTerritorialName('Zona de Amortiguamiento')).toBe(true)
    expect(isGenericTerritorialName('Volcán Acatenango')).toBe(false)
  })

  it('combina nombre genérico con área general', () => {
    expect(
      buildTerritorialDisplayName({
        specific_name: 'Zona de Amortiguamiento',
        general_name: 'Reserva de la Biosfera Maya',
      }),
    ).toBe('Zona de Amortiguamiento — Reserva de la Biosfera Maya')
  })

  it('usa categoría específica cuando el nombre general está abreviado', () => {
    expect(
      buildTerritorialDisplayName({
        specific_name: 'Zona de Amortiguamiento',
        general_name: 'Maya',
        general_category: 'Reserva de la Biosfera',
        specific_category: 'Reserva de la Biosfera Maya',
      }),
    ).toBe('Zona de Amortiguamiento — Reserva de la Biosfera Maya')
  })

  it('usa nombre específico descriptivo sin combinar', () => {
    expect(
      buildTerritorialDisplayName({
        specific_name: 'Volcán Acatenango',
        general_name: 'Parque Nacional',
      }),
    ).toBe('Volcán Acatenango')
  })
})
