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
    })
    expect(narrative).toContain('documentaron')
    expect(narrative).not.toMatch(/inventario completo/i)
    expect(narrative).not.toMatch(/ausencia biológica/i)
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
    })
    expect(narrative).toContain('no se recuperaron observaciones')
    expect(narrative).toContain('no ausencia biológica')
  })

  it('zone narrative avoids extinction risk claims', () => {
    const narrative = buildZoneBiodiversityNarrative({
      zoneName: 'Acatenango',
      speciesCount: 5,
      observationsCount: 20,
      recentCount: 2,
      periodLabel: 'los últimos 90 días',
    })
    expect(narrative).toContain('Acatenango')
    expect(narrative).toContain('riesgo de extinción')
    expect(narrative).toMatch(/no se infiere/i)
  })
})
