import { describe, expect, it } from 'vitest'

import { resolveThermalDataStatus } from '@/modules/fires/utils/thermal-data-status'
import { buildFireDataStatus } from '@/modules/fires/api/fire-ingestion-status'
import type { FirePipelineHealthDto } from '@/modules/fires/types/fire.dto'

function health(overrides: Partial<FirePipelineHealthDto>): FirePipelineHealthDto {
  return {
    enabled: true,
    interval_minutes: 30,
    is_running: false,
    scheduler_active: true,
    last_run: null,
    last_success_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    consecutive_failures: 0,
    next_run_at: new Date().toISOString(),
    failed_runs_last_24h: 0,
    partial_runs_last_24h: 0,
    is_healthy: true,
    is_stale: false,
    alert_level: 'ok',
    generated_at: new Date().toISOString(),
    ...overrides,
  }
}

function baseDataStatus() {
  return buildFireDataStatus({
    lastFirmsIngestionAt: new Date().toISOString(),
    lastSuccessfulIngestionAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    latestSatelliteAcquisitionAt: new Date().toISOString(),
    sourcesWithDetections: 3,
    ingestion: {
      sources_expected: 4,
      sources_queried_successfully: 4,
      sources_failed: 0,
      failed_source_names: [],
      ingestion_status: 'success',
      is_partial: false,
      observations_downloaded: 120,
    },
    isStale: false,
    staleAfterMinutes: 180,
  })
}

describe('resolveThermalDataStatus', () => {
  it('returns Datos actualizados when ingestion and pipeline are healthy', () => {
    const status = resolveThermalDataStatus({
      dataStatus: baseDataStatus(),
      pipelineHealth: health({}),
    })
    expect(status.label).toBe('Datos actualizados')
    expect(status.firmsProvidersLine).toBe('Proveedores FIRMS operativos: 4 de 4')
    expect(status.nextUpdateLine).toContain('Próxima actualización estimada')
  })

  it('returns Datos retrasados when stale', () => {
    const status = resolveThermalDataStatus({
      dataStatus: baseDataStatus(),
      pipelineHealth: health({ is_healthy: false, is_stale: true, alert_level: 'warning' }),
    })
    expect(status.label).toBe('Datos retrasados')
  })

  it('returns Datos parcialmente actualizados when sources fail', () => {
    const status = resolveThermalDataStatus({
      dataStatus: buildFireDataStatus({
        lastFirmsIngestionAt: new Date().toISOString(),
        lastSuccessfulIngestionAt: new Date().toISOString(),
        latestSatelliteAcquisitionAt: new Date().toISOString(),
        sourcesWithDetections: 2,
        ingestion: {
          sources_expected: 4,
          sources_queried_successfully: 3,
          sources_failed: 1,
          failed_source_names: ['MODIS_NRT'],
          ingestion_status: 'partial',
          is_partial: true,
          observations_downloaded: 80,
        },
        isStale: false,
        staleAfterMinutes: 180,
      }),
      pipelineHealth: health({}),
    })
    expect(status.label).toBe('Datos parcialmente actualizados')
  })

  it('returns Proceso con fallos on critical pipeline alert', () => {
    const status = resolveThermalDataStatus({
      dataStatus: baseDataStatus(),
      pipelineHealth: health({ alert_level: 'critical', consecutive_failures: 4, is_healthy: false }),
    })
    expect(status.label).toBe('Proceso con fallos')
  })

  it('returns Sin datos recientes when no observations and no successful run', () => {
    const status = resolveThermalDataStatus({
      dataStatus: buildFireDataStatus({
        lastFirmsIngestionAt: null,
        lastSuccessfulIngestionAt: null,
        latestSatelliteAcquisitionAt: null,
        sourcesWithDetections: 0,
        ingestion: {
          sources_expected: 4,
          sources_queried_successfully: 0,
          sources_failed: 0,
          failed_source_names: [],
          ingestion_status: 'success',
          is_partial: false,
          observations_downloaded: 0,
        },
        isStale: false,
        staleAfterMinutes: 180,
      }),
      pipelineHealth: health({ last_success_at: null }),
    })
    expect(status.label).toBe('Sin datos recientes')
  })
})
