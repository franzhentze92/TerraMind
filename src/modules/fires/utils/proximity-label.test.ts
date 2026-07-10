import { describe, expect, it } from 'vitest'
import {
  computeProximityLabel,
  formatDistanceM,
  proximityLabelText,
} from '@/modules/fires/utils/proximity-label'

describe('proximity-label', () => {
  it('marca dentro cuando hay intersección confirmada', () => {
    expect(computeProximityLabel(500, true)).toBe('dentro')
  })

  it('clasifica distancias operativas', () => {
    expect(computeProximityLabel(0, false)).toBe('muy_cerca')
    expect(computeProximityLabel(800, false)).toBe('muy_cerca')
    expect(computeProximityLabel(2500, false)).toBe('cerca')
    expect(computeProximityLabel(7500, false)).toBe('entorno_proximo')
    expect(computeProximityLabel(15000, false)).toBe('distante')
  })

  it('distancia 0 cuando intersecta', () => {
    expect(computeProximityLabel(0, true)).toBe('dentro')
  })

  it('formatea distancias', () => {
    expect(formatDistanceM(0)).toBe('0 m')
    expect(formatDistanceM(4800)).toBe('4.8 km')
  })

  it('etiquetas legibles', () => {
    expect(proximityLabelText('muy_cerca')).toContain('1 km')
  })
})
