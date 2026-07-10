import { describe, expect, it } from 'vitest'
import {
  decodeGbifCursor,
  encodeGbifCursor,
  extractInaturalistIdFromGbif,
  inferGbifRecordKind,
  mapGbifOccurrence,
  mapGbifSpeciesMatch,
} from './gbif.mapper'
import type { GbifOccurrenceRecord } from './gbif.types'

describe('gbif.mapper', () => {
  it('maps occurrence with license warning when missing', () => {
    const record: GbifOccurrenceRecord = {
      key: 123,
      scientificName: 'Panthera onca',
      decimalLatitude: 17.5,
      decimalLongitude: -90.2,
      eventDate: '2020-05-01',
      basisOfRecord: 'HUMAN_OBSERVATION',
      occurrenceStatus: 'PRESENT',
    }
    const mapped = mapGbifOccurrence(record, '2026-01-01T00:00:00.000Z')
    expect(mapped.source).toBe('gbif')
    expect(mapped.recordKind).toBe('human_observation')
    expect(mapped.qualityWarnings).toContain('unknown_license')
  })

  it('infers citizen science from iNat reference', () => {
    const record: GbifOccurrenceRecord = {
      key: 1,
      references: 'https://www.inaturalist.org/observations/999',
      basisOfRecord: 'HUMAN_OBSERVATION',
    }
    expect(inferGbifRecordKind(record)).toBe('citizen_science_observation')
    expect(extractInaturalistIdFromGbif(record)).toBe('999')
  })

  it('encodes and decodes cursor', () => {
    const cursor = encodeGbifCursor(300)
    expect(decodeGbifCursor(cursor)).toBe(300)
  })

  it('maps species match', () => {
    const taxon = mapGbifSpeciesMatch(
      {
        usageKey: 5219404,
        scientificName: 'Panthera onca',
        rank: 'SPECIES',
        matchType: 'EXACT',
        confidence: 99,
      },
      '2026-01-01T00:00:00.000Z',
    )
    expect(taxon?.sourceTaxonId).toBe('5219404')
  })
})
