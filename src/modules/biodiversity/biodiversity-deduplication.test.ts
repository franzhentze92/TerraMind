import { describe, expect, it } from 'vitest'
import { markBiodiversityDuplicates } from './biodiversity-deduplication'
import { detectGbifInaturalistProvenance } from './biodiversity-gbif-inaturalist-provenance'
import { BIODIVERSITY_CONFIG } from './config/biodiversity.config'
import type { BiodiversityOccurrence } from './biodiversity.types'

function occ(
  source: 'gbif' | 'inaturalist',
  id: string,
  overrides: Partial<BiodiversityOccurrence> = {},
): BiodiversityOccurrence {
  return {
    source,
    sourceOccurrenceId: id,
    scientificName: 'Panthera onca',
    coordinatesObscured: false,
    privacyLevel: 'public_exact',
    sourceUrl:
      source === 'gbif'
        ? `https://www.inaturalist.org/observations/${id}`
        : `https://www.inaturalist.org/observations/${id}`,
    recordKind: source === 'inaturalist' ? 'citizen_science_observation' : 'human_observation',
    possibleDuplicate: false,
    fetchedAt: '2026-01-01T00:00:00.000Z',
    qualityWarnings: [],
    observedAt: '2024-01-15',
    eventDatePrecision: 'day',
    latitude: 17.12,
    longitude: -90.45,
    ...overrides,
  }
}

describe('biodiversity-deduplication', () => {
  it('groups same iNaturalist observation published in GBIF as exact/high', () => {
    const items = markBiodiversityDuplicates([
      occ('gbif', '100', { sourceUrl: 'https://www.inaturalist.org/observations/555' }),
      occ('inaturalist', '555'),
    ])
    const dupes = items.filter((i) => i.possibleDuplicate)
    expect(dupes).toHaveLength(2)
    expect(dupes.every((d) => d.duplicateGroupId)).toBe(true)
    expect(dupes[0]?.deduplicationConfidence).toMatch(/exact|high/)
  })

  it('does not fuse two distinct observations of same species on same day', () => {
    const items = markBiodiversityDuplicates([
      occ('gbif', '1', {
        sourceUrl: 'https://www.gbif.org/occurrence/1',
        sourceReference: undefined,
        sourceDatasetId: undefined,
        latitude: 17.0,
        longitude: -90.0,
      }),
      occ('inaturalist', '2', {
        sourceUrl: 'https://www.inaturalist.org/observations/2',
        latitude: 18.5,
        longitude: -91.2,
      }),
    ])
    expect(items.every((i) => !i.possibleDuplicate)).toBe(true)
    expect(items.every((i) => !i.duplicateGroupId)).toBe(true)
  })

  it('reports medium/low candidate for similar taxon+date+coords without shared id', () => {
    const items = markBiodiversityDuplicates([
      occ('gbif', 'g1', {
        sourceDatasetId: BIODIVERSITY_CONFIG.inaturalist.gbifDatasetKey,
        datasetTitle: 'iNaturalist research-grade observations',
        sourceUrl: 'https://www.gbif.org/occurrence/g1',
        sourceReference: undefined,
      }),
      occ('inaturalist', 'i9', {
        sourceUrl: 'https://www.inaturalist.org/observations/i9',
      }),
    ])
    const candidates = items.filter((i) => i.duplicateCandidate)
    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates.every((c) => !c.duplicateGroupId)).toBe(true)
    expect(candidates[0]?.deduplicationConfidence).toMatch(/medium|low/)
  })

  it('skips aggressive dedup for obscured observations', () => {
    const items = markBiodiversityDuplicates([
      occ('gbif', 'g1', {
        sourceDatasetId: BIODIVERSITY_CONFIG.inaturalist.gbifDatasetKey,
        sourceUrl: 'https://www.gbif.org/occurrence/g1',
      }),
      occ('inaturalist', 'i9', {
        coordinatesObscured: true,
        privacyLevel: 'sensitive_generalized',
      }),
    ])
    expect(items.every((i) => !i.possibleDuplicate)).toBe(true)
    expect(items.every((i) => !i.duplicateCandidate)).toBe(true)
  })

  it('does not auto-fuse historical records without precise date', () => {
    const items = markBiodiversityDuplicates([
      occ('gbif', 'g1', {
        observedAt: '1998',
        eventDatePrecision: 'year',
        sourceDatasetId: BIODIVERSITY_CONFIG.inaturalist.gbifDatasetKey,
        sourceUrl: 'https://www.gbif.org/occurrence/g1',
      }),
      occ('inaturalist', 'i9', {
        observedAt: '1998-01-01',
        eventDatePrecision: 'day',
        sourceUrl: 'https://www.inaturalist.org/observations/i9',
      }),
    ])
    expect(items.every((i) => !i.possibleDuplicate)).toBe(true)
  })

  it('does not mark all GBIF iNaturalist dataset records as duplicates among themselves', () => {
    const items = markBiodiversityDuplicates([
      occ('gbif', 'a', {
        sourceDatasetId: BIODIVERSITY_CONFIG.inaturalist.gbifDatasetKey,
        sourceUrl: 'https://www.gbif.org/occurrence/a',
        sourceReference: undefined,
        scientificName: 'Species A',
      }),
      occ('gbif', 'b', {
        sourceDatasetId: BIODIVERSITY_CONFIG.inaturalist.gbifDatasetKey,
        sourceUrl: 'https://www.gbif.org/occurrence/b',
        sourceReference: undefined,
        scientificName: 'Species B',
      }),
    ])
    expect(items.every((i) => !i.possibleDuplicate)).toBe(true)
  })

  it('never removes records from output', () => {
    const input = [occ('gbif', '1'), occ('inaturalist', '2')]
    expect(markBiodiversityDuplicates(input)).toHaveLength(input.length)
  })
})

describe('detectGbifInaturalistProvenance', () => {
  it('detects provenance signals without marking duplicate', () => {
    const provenance = detectGbifInaturalistProvenance(
      occ('gbif', '1', {
        sourceDatasetId: BIODIVERSITY_CONFIG.inaturalist.gbifDatasetKey,
        datasetTitle: 'iNaturalist Observations',
        publishingOrganization: 'iNaturalist',
        sourceUrl: 'https://www.inaturalist.org/observations/42',
        dwcOccurrenceId: '42',
      }),
    )
    expect(provenance.isFromInaturalist).toBe(true)
    expect(provenance.signals.length).toBeGreaterThan(1)
    expect(provenance.inaturalistObservationId).toBe('42')
  })
})
