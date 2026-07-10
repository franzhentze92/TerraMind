import {
  fetchFirmsDetections,
  firmsRowsToObservations,
  FirmsApiError,
} from '@/pipeline/connectors/firms.connector'
import { processObservations } from '@/pipeline/engines/observation.engine'
import { buildSituationReport, createTimelineEntry } from '@/pipeline/engines/report.engine'
import { getStore } from '@/pipeline/stores/file.store'
import type { FirmsHealth, PipelineRunResult, SituationReport } from '@/pipeline/types'

let isRunning = false

function mapErrorToHealth(err: FirmsApiError): FirmsHealth {
  if (err.code === 'UNCONFIGURED') {
    return { status: 'unconfigured', lastError: err.message }
  }
  if (err.code === 'INVALID_KEY') {
    return { status: 'offline', lastError: err.message }
  }
  return { status: 'degraded', lastError: err.message }
}

/**
 * Pipeline Sprint 1 — solo ingesta:
 * NASA FIRMS → CSV → Observation → almacenamiento → UI
 */
export async function runPipeline(): Promise<PipelineRunResult> {
  if (isRunning) {
    return {
      runId: `run:skipped:${Date.now()}`,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      observationsIngested: 0,
      eventsCreated: 0,
      hallazgosCreated: 0,
      hallazgosUpdated: 0,
      source: 'nasa-firms',
      errors: ['Pipeline already running'],
      detectionsFetched: 0,
      detectionsTotal: getStore().get().observations.length,
    }
  }

  isRunning = true
  const startedAt = new Date().toISOString()
  const runId = `run:${Date.now()}`
  const errors: string[] = []
  const store = getStore()

  store.update((s) => ({
    ...s,
    firmsHealth: { ...s.firmsHealth, status: 'syncing' },
    timeline: [
      createTimelineEntry('TerraMind inició sincronización FIRMS', 'NASA FIRMS', 'analyzing'),
      ...s.timeline,
    ],
  }))

  try {
    const firmsResult = await fetchFirmsDetections()
    const ingestedAt = new Date().toISOString()
    const incoming = firmsRowsToObservations(firmsResult.rows, ingestedAt)

    store.update((s) => ({
      ...s,
      timeline: [
        createTimelineEntry(
          `${firmsResult.rows.length} focos de calor detectados (VIIRS ×3, ${firmsResult.sourceSummaries.map((s) => `${s.source.split('_')[1]}:${s.rows}`).join(', ')})`,
          'NASA FIRMS',
          'processed',
        ),
        ...s.timeline,
      ],
    }))

    const { newObservations } = processObservations(incoming, store.get().observations)

    store.update((s) => ({
      ...s,
      observations: [...s.observations, ...newObservations],
      firmsHealth: {
        status: 'connected',
        lastSuccessfulSyncAt: ingestedAt,
        detectionsLastSync: firmsResult.rows.length,
        latencyMs: firmsResult.latencyMs,
      },
      timeline: [
        createTimelineEntry(
          `${newObservations.length} observaciones nuevas · ${s.observations.length + newObservations.length} acumuladas`,
          'Observation Engine',
          'processed',
        ),
        ...s.timeline,
      ],
    }))

    const completedAt = new Date().toISOString()
    const totalObs = store.get().observations.length

    const result: PipelineRunResult = {
      runId,
      startedAt,
      completedAt,
      observationsIngested: newObservations.length,
      eventsCreated: 0,
      hallazgosCreated: 0,
      hallazgosUpdated: 0,
      source: 'nasa-firms',
      errors,
      detectionsFetched: firmsResult.rows.length,
      detectionsTotal: totalObs,
    }

    store.update((s) => ({
      ...s,
      lastSyncAt: completedAt,
      lastRun: result,
      timeline: [
        createTimelineEntry(
          `Sincronización completada · ${totalObs} detecciones almacenadas`,
          'Data Connector',
          'processed',
        ),
        ...s.timeline,
      ],
    }))

    return result
  } catch (err) {
    const firmsErr =
      err instanceof FirmsApiError
        ? err
        : new FirmsApiError(
            'NETWORK',
            err instanceof Error ? err.message : 'Error desconocido en ingesta FIRMS',
          )

    errors.push(firmsErr.message)
    const health = mapErrorToHealth(firmsErr)

    store.update((s) => ({
      ...s,
      firmsHealth: {
        ...s.firmsHealth,
        ...health,
      },
      timeline: [
        createTimelineEntry(
          `Sincronización FIRMS fallida — conservando últimos datos válidos`,
          'NASA FIRMS',
          'waiting',
        ),
        ...s.timeline,
      ],
    }))

    return {
      runId,
      startedAt,
      completedAt: new Date().toISOString(),
      observationsIngested: 0,
      eventsCreated: 0,
      hallazgosCreated: 0,
      hallazgosUpdated: 0,
      source: 'nasa-firms',
      errors,
      detectionsFetched: 0,
      detectionsTotal: store.get().observations.length,
    }
  } finally {
    isRunning = false
  }
}

export function getSituationReport(): SituationReport {
  return buildSituationReport(getStore().get())
}

export function isPipelineRunning(): boolean {
  return isRunning
}
