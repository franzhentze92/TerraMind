import { describe, expect, it } from 'vitest'
import {
  buildFirmsObservationId,
  buildUtcTimestamp,
  normalizeAcqDate,
  normalizeAcqTime,
  parseFirmsCsv,
} from '@/pipeline/connectors/firms.parser'
import { firmsRowsToObservations } from '@/pipeline/connectors/firms.connector'
import { processObservations } from '@/pipeline/engines/observation.engine'

const SAMPLE_HEADER =
  'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight'

const VALID_ROW =
  '16.91000,-89.89000,320.5,0.4,0.3,2026-07-09,1345,N,VIIRS,high,2.0NRT,285.1,42.3,D'

describe('parseFirmsCsv', () => {
  it('returns empty rows for empty CSV', () => {
    const result = parseFirmsCsv('')
    expect(result.rows).toHaveLength(0)
    expect(result.stats.totalLines).toBe(0)
  })

  it('returns empty rows for header-only CSV', () => {
    const result = parseFirmsCsv(SAMPLE_HEADER)
    expect(result.rows).toHaveLength(0)
    expect(result.stats.totalLines).toBe(0)
  })

  it('parses a valid VIIRS row', () => {
    const result = parseFirmsCsv(`${SAMPLE_HEADER}\n${VALID_ROW}`)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].latitude).toBe(16.91)
    expect(result.rows[0].frp).toBe(42.3)
    expect(result.rows[0].satellite).toBe('N')
    expect(result.stats.validRows).toBe(1)
  })

  it('skips row with invalid coordinates', () => {
    const csv = `${SAMPLE_HEADER}\n999,999,320,0.4,0.3,2026-07-09,1345,N,VIIRS,high,2.0,285,42,D`
    const result = parseFirmsCsv(csv)
    expect(result.rows).toHaveLength(0)
    expect(result.stats.skippedRows).toBe(1)
    expect(result.stats.skipReasons.out_of_range_coordinates).toBe(1)
  })

  it('skips row with missing date', () => {
    const csv = `${SAMPLE_HEADER}\n16.91,-89.89,320,0.4,0.3,,1345,N,VIIRS,high,2.0,285,42,D`
    const result = parseFirmsCsv(csv)
    expect(result.rows).toHaveLength(0)
    expect(result.stats.skipReasons.invalid_date).toBe(1)
  })

  it('accepts missing frp as null', () => {
    const csv = `${SAMPLE_HEADER}\n16.91,-89.89,320,0.4,0.3,2026-07-09,1345,N,VIIRS,high,2.0,285,,D`
    const result = parseFirmsCsv(csv)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].frp).toBeNull()
  })
})

describe('UTC timestamps', () => {
  it('normalizes YYYYMMDD date', () => {
    expect(normalizeAcqDate('20260709')).toBe('2026-07-09')
  })

  it('normalizes acq_time to HHMM', () => {
    expect(normalizeAcqTime('345')).toBe('0345')
    expect(normalizeAcqTime('1345')).toBe('1345')
  })

  it('builds UTC ISO timestamp', () => {
    expect(buildUtcTimestamp('2026-07-09', '1345')).toBe('2026-07-09T13:45:00Z')
    expect(buildUtcTimestamp('20260709', '1345')).toBe('2026-07-09T13:45:00Z')
  })
})

describe('deduplication', () => {
  it('generates deterministic observation IDs', () => {
    const result = parseFirmsCsv(`${SAMPLE_HEADER}\n${VALID_ROW}`)
    const row = result.rows[0]
    const id1 = buildFirmsObservationId(row)
    const id2 = buildFirmsObservationId(row)
    expect(id1).toBe(id2)
    expect(id1).toContain('nasa-firms')
  })

  it('deduplicates identical observations on ingest', () => {
    const result = parseFirmsCsv(`${SAMPLE_HEADER}\n${VALID_ROW}`)
    const ingestedAt = '2026-07-10T00:00:00Z'
    const obs = firmsRowsToObservations(result.rows, ingestedAt)
    const first = processObservations(obs, [])
    const second = processObservations(obs, obs)
    expect(first.newObservations).toHaveLength(1)
    expect(second.newObservations).toHaveLength(0)
  })
})

describe('FirmsApiError cases', () => {
  it('detects invalid key patterns in error body', async () => {
    const { FirmsApiError } = await import('@/pipeline/connectors/firms.connector')
    const err = new FirmsApiError('INVALID_KEY', 'Credencial NASA FIRMS inválida.')
    expect(err.code).toBe('INVALID_KEY')
    expect(err.message).not.toContain('MAP_KEY')
  })
})

describe('buildFirmsAreaCsvUrl', () => {
  it('uses comma-separated bbox per NASA FIRMS API', async () => {
    const { buildFirmsAreaCsvUrl } = await import('@/pipeline/connectors/firms.config')
    const url = buildFirmsAreaCsvUrl('test-key')
    expect(url).toContain('/VIIRS_SNPP_NRT/-92.5,13.5,-88,18/2')
  })
})
