import { describe, expect, it } from 'vitest'
import {
  groupLandCoverDistribution,
  formatLandCoverPercentage,
} from '@/modules/fires/utils/land-cover-distribution'

describe('land-cover distribution grouping', () => {
  it('agrupa clases menores en Otros', () => {
    const grouped = groupLandCoverDistribution(
      [
        { class: 'grassland', label: 'Pastizal', percentage: 72.4 },
        { class: 'forest', label: 'Bosque', percentage: 18 },
        { class: 'cropland', label: 'Cultivo', percentage: 7 },
        { class: 'shrubland', label: 'Matorral', percentage: 2 },
        { class: 'built_up', label: 'Área construida', percentage: 0.5 },
        { class: 'bare_sparse', label: 'Suelo desnudo', percentage: 0.1 },
      ],
      5,
    )
    expect(grouped).toHaveLength(6)
    expect(grouped.at(-1)?.label).toBe('Otros')
    expect(grouped.reduce((s, r) => s + r.percentage, 0)).toBeCloseTo(100, 1)
  })

  it('mantiene hasta cinco clases sin Otros si caben', () => {
    const grouped = groupLandCoverDistribution(
      [
        { class: 'grassland', label: 'Pastizal', percentage: 60 },
        { class: 'forest', label: 'Bosque', percentage: 40 },
      ],
      5,
    )
    expect(grouped).toHaveLength(2)
    expect(grouped.some((r) => r.label === 'Otros')).toBe(false)
  })

  it('formatea porcentajes con una decimal cuando aplica', () => {
    expect(formatLandCoverPercentage(72)).toBe('72')
    expect(formatLandCoverPercentage(72.4)).toBe('72.4')
  })
})
