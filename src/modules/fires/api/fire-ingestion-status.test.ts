import { describe, expect, it } from 'vitest'
import {
  buildFireDataStatus,
  countSourcesWithDetections,
  parseIngestionRunStatus,
} from '@/modules/fires/api/fire-ingestion-status'
import {
  buildFireExecutiveBrief,
  buildFireTimeline,
} from '@/modules/fires/utils/fire-dashboard'
import type { FireSummaryDto } from '@/modules/fires/types/fire.dto'

const baseSummary: FireSummaryDto = {
  window_hours: 48,
  window_start_utc: '2026-07-08T00:00:00.000Z',
  window_end_utc: '2026-07-10T00:00:00.000Z',
  observations_downloaded: 31,
  detections_count: 10,
  detections_outside_count: 21,
  events_count: 5,
  active_events_count: 3,
  monitoring_events_count: 2,
  attention_events_count: 1,
  probable_events_count: 3,
  multisatellite_events_count: 1,
  confirmed_events_count: 0,
  departments_affected_count: 5,
  highest_priority_event: {
    id: 'evt-1',
    department: 'Retalhuleu',
    risk_level: 'atencion',
    priority_score: 54,
    detection_count: 3,
    satellite_count: 2,
    last_detected_at: '2026-07-09T20:12:00.000Z',
  },
  data_status: buildFireDataStatus({
    lastFirmsIngestionAt: '2026-07-10T06:00:00.000Z',
    lastSuccessfulIngestionAt: '2026-07-10T06:00:00.000Z',
    latestSatelliteAcquisitionAt: '2026-07-09T20:12:00.000Z',
    sourcesWithDetections: 2,
    ingestion: parseIngestionRunStatus({
      status: 'success',
      sources_queried: ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT', 'MODIS_NRT'],
      http_status: {
        VIIRS_SNPP_NRT: 200,
        VIIRS_NOAA20_NRT: 200,
        VIIRS_NOAA21_NRT: 200,
        MODIS_NRT: 200,
      },
      rows_received: 31,
    }),
    isStale: false,
    staleAfterMinutes: 180,
  }),
  generated_at: '2026-07-10T07:00:00.000Z',
}

describe('parseIngestionRunStatus', () => {
  it('does not mark partial when all sources succeed with zero detections', () => {
    const result = parseIngestionRunStatus({
      status: 'success',
      sources_queried: ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT', 'MODIS_NRT'],
      http_status: {
        VIIRS_SNPP_NRT: 200,
        VIIRS_NOAA20_NRT: 200,
        VIIRS_NOAA21_NRT: 200,
        MODIS_NRT: 200,
      },
      rows_received: 31,
    })
    expect(result.sources_queried_successfully).toBe(4)
    expect(result.sources_failed).toBe(0)
    expect(result.is_partial).toBe(false)
  })

  it('marks partial when a source fails', () => {
    const result = parseIngestionRunStatus({
      status: 'partial',
      sources_queried: ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT', 'MODIS_NRT'],
      http_status: {
        VIIRS_SNPP_NRT: 200,
        VIIRS_NOAA20_NRT: 200,
        VIIRS_NOAA21_NRT: 0,
        MODIS_NRT: 200,
      },
      rows_received: 20,
    })
    expect(result.sources_queried_successfully).toBe(3)
    expect(result.sources_failed).toBe(1)
    expect(result.is_partial).toBe(true)
    expect(result.failed_source_names).toContain('VIIRS_NOAA21_NRT')
  })
})

describe('countSourcesWithDetections', () => {
  it('counts only expected sources with detections in window', () => {
    expect(
      countSourcesWithDetections(['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'OTHER']),
    ).toBe(2)
  })
})

describe('buildFireExecutiveBrief', () => {
  it('mentions attention when attention_events_count > 0', () => {
    const brief = buildFireExecutiveBrief(baseSummary)
    expect(brief.priorityIntro).toContain('1 situación prioritaria')
    expect(brief.fullAnalysis).toContain('Retalhuleu')
    expect(brief.fullAnalysis).toContain('5 eventos térmicos')
    expect(brief.fullAnalysis).toContain('10 detecciones')
    expect(brief.fullAnalysis).not.toContain('incendio confirmado')
  })

  it('handles zero events without attention', () => {
    const brief = buildFireExecutiveBrief({
      ...baseSummary,
      events_count: 0,
      attention_events_count: 0,
      highest_priority_event: null,
      detections_count: 0,
    })
    expect(brief.priorityIntro).toContain('No se identificaron situaciones prioritarias')
    expect(brief.fullAnalysis).toContain('no identificó eventos térmicos')
  })
})

describe('buildFireTimeline', () => {
  it('uses pipeline steps consistent with summary counts', () => {
    const timeline = buildFireTimeline(baseSummary)
    expect(timeline[0]?.label).toContain('31 observaciones')
    expect(timeline[1]?.label).toContain('10 detecciones')
    expect(timeline[1]?.label).toContain('21 fuera')
    expect(timeline[2]?.label).toContain('5 eventos')
    expect(timeline.some((e) => e.label.includes('Retalhuleu'))).toBe(true)
    expect(timeline.some((e) => e.label.includes('4/4 fuentes operativas'))).toBe(true)
  })
})
