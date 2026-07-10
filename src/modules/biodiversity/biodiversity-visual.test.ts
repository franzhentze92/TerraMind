import { describe, expect, it } from 'vitest'
import { evaluateImageDisplay } from './biodiversity-media-license'
import { selectFeaturedSpecies } from './biodiversity-visual-select'
import {
  biodiversityVisualStatusMessage,
  formatResearchGradeLabel,
} from './biodiversity-visual-status'
import type { BiodiversityObservationVisual } from './biodiversity-visual.types'

function visual(overrides: Partial<BiodiversityObservationVisual>): BiodiversityObservationVisual {
  return {
    source: 'inaturalist',
    sourceOccurrenceId: '1',
    imageUrl: 'https://example.com/m.jpg',
    thumbnailUrl: 'https://example.com/s.jpg',
    imageAttribution: 'test',
    observationUrl: 'https://example.com',
    taxonName: 'Turdus migratorius',
    taxonomicGroup: 'birds',
    taxonomicGroupLabel: 'Aves',
    zoneCode: 'maya',
    zoneName: 'Maya',
    privacyLevel: 'public_exact',
    coordinatesPrivacyLabel: 'pública',
    isRecent: true,
    isVisualCandidate: true,
    sortScore: 0,
    ...overrides,
  }
}

describe('biodiversity-media-license', () => {
  it('allows CC-BY images', () => {
    const r = evaluateImageDisplay('CC-BY-4.0')
    expect(r.allowed).toBe(true)
  })

  it('blocks unknown license', () => {
    const r = evaluateImageDisplay(undefined)
    expect(r.allowed).toBe(false)
  })
})

describe('biodiversity-visual-select', () => {
  it('picks diverse featured species', () => {
    const items = selectFeaturedSpecies([
      visual({ taxonName: 'Aves sp', taxonomicGroup: 'birds' }),
      visual({ taxonName: 'Plant sp', taxonomicGroup: 'plants', commonName: 'Orquídea' }),
    ])
    expect(items).toHaveLength(2)
    expect(items[0].scientificName).toBeTruthy()
    expect(items[0].sourceOccurrenceId).toBeTruthy()
  })
})

describe('biodiversity-visual-status', () => {
  it('shows N/D when no iNaturalist records', () => {
    expect(formatResearchGradeLabel(0, 0)).toBe('Research grade: N/D')
    expect(formatResearchGradeLabel(null, 5)).toBe('Research grade: N/D')
    expect(formatResearchGradeLabel(40, 10)).toBe('Research grade: 40%')
  })

  it('returns empty state message', () => {
    expect(
      biodiversityVisualStatusMessage(
        {
          status: 'empty',
          narrative: 'x',
        } as never,
        {},
      ),
    ).toContain('No se encontró evidencia fotográfica')
  })
})
