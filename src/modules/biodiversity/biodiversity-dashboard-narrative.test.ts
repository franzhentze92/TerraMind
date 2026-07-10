import { describe, expect, it } from 'vitest'
import {
  buildNationalBiodiversityNarrative,
  buildZoneBiodiversityNarrative,
} from './biodiversity-dashboard-narrative'

describe('biodiversity-dashboard-narrative', () => {
  it('does not claim total biodiversity or absence', () => {
    const narrative = buildNationalBiodiversityNarrative({
      speciesCount: 12,
      observationsCount: 40,
      recent30d: 3,
      zonesMonitored: 5,
      topZoneName: 'Maya',
      topZoneSpecies: 8,
      generalizedCount: 2,
      dataStatus: 'success',
      periodLabel: 'los últimos 5 años',
      truncated: false,
    })
    expect(narrative).toContain('documentaron')
    expect(narrative).toContain('12 especies distintas')
    expect(narrative).not.toMatch(/inventario completo/i)
    expect(narrative).toContain('Mayor riqueza documentada')
  })

  it('handles zero observations without absence claim', () => {
    const narrative = buildNationalBiodiversityNarrative({
      speciesCount: 0,
      observationsCount: 0,
      recent30d: 0,
      zonesMonitored: 3,
      topZoneName: null,
      topZoneSpecies: 0,
      generalizedCount: 0,
      dataStatus: 'no_recent_observations',
      periodLabel: 'los últimos 30 días',
      truncated: false,
    })
    expect(narrative).toContain('no se recuperaron observaciones')
    expect(narrative).toContain('no ausencia biológica')
  })

  it('zone narrative avoids extinction risk and notes low coverage', () => {
    const narrative = buildZoneBiodiversityNarrative({
      zoneName: 'Manchón Guamuchal',
      speciesCount: 2,
      observationsCount: 4,
      recentCount: 0,
      periodLabel: 'los últimos 30 días',
      truncated: false,
      lowCoverage: true,
    })
    expect(narrative).toContain('Baja cobertura de observación')
    expect(narrative).toContain('riesgo de extinción')
    expect(narrative).toMatch(/no se infiere/i)
  })
})
