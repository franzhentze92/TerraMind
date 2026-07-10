import { describe, expect, it } from 'vitest'
import { classifyLandCoverJobError } from '@/pipeline/engines/fire/context/land-cover-errors'
import { LandCoverSourceUnavailableError } from '@/pipeline/engines/fire/context/land-cover.engine'
import { StageTimeoutError } from '@/pipeline/utils/timeout'
import { buildLandCoverEnrichmentState } from '@/modules/fires/utils/land-cover-enrichment-state'

describe('land-cover job errors', () => {
  it('clasifica timeout GDAL como retryable', () => {
    const result = classifyLandCoverJobError(new StageTimeoutError('land_cover_job', 1000))
    expect(result.retryable).toBe(true)
    expect(result.code).toBe('job_timeout')
  })

  it('clasifica raster no disponible como no retryable', () => {
    const result = classifyLandCoverJobError(new LandCoverSourceUnavailableError())
    expect(result.retryable).toBe(false)
    expect(result.code).toBe('source_unavailable')
  })

  it('clasifica geometría inválida como no retryable', () => {
    const result = classifyLandCoverJobError(new Error('Geometría inválida permanente'))
    expect(result.retryable).toBe(false)
    expect(result.code).toBe('invalid_geometry')
  })
})

describe('land-cover enrichment state', () => {
  it('marca queued cuando hay job pending', () => {
    const state = buildLandCoverEnrichmentState(null, {
      id: 'job-1',
      event_id: 'evt-1',
      requested_context_version: 'v1',
      status: 'pending',
      priority: 0,
      attempts: 0,
      max_attempts: 3,
      available_at: '2026-07-10T10:00:00.000Z',
      locked_at: null,
      locked_by: null,
      started_at: null,
      completed_at: null,
      last_error_code: null,
      last_error_message: null,
      created_at: '2026-07-10T10:00:00.000Z',
      updated_at: '2026-07-10T10:00:00.000Z',
    })
    expect(state?.status).toBe('queued')
    expect(state?.message).toContain('procesamiento')
  })

  it('marca complete cuando existe contexto', () => {
    const state = buildLandCoverEnrichmentState(
      {
        status: 'complete',
        source: { name: 'ESA WorldCover', version: '2021 v200', year: 2021, resolution_m: 10 },
        generated_at: '2026-07-10T10:00:00.000Z',
        context_version: 'v1',
        point_evidence: {
          detections_sampled: 1,
          dominant_class: 'forest',
          mixed: false,
          class_distribution: [],
        },
        zones: [],
        warnings: [],
        disclaimer: 'disclaimer',
      },
      null,
    )
    expect(state?.status).toBe('complete')
  })
})
