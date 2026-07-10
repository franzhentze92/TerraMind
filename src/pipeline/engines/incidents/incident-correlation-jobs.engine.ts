import { loadIncidentWorkerConfig } from '@/pipeline/config/incident-worker.config'
import { FIRE_INCIDENT_CORRELATION_MODEL_VERSION } from '@/modules/incidents/config/fire-incident-correlation.config'
import { listFireEventCandidatesForIncidentCorrelation } from '@/modules/incidents/services/fire-incident-snapshot.loader'
import {
  getActiveIncidentCorrelationJobForEvent,
  insertIncidentCorrelationJob,
} from '@/pipeline/stores/incident-correlation-jobs.store'

export async function enqueueIncidentCorrelationJobs(options: {
  limit?: number
  force?: boolean
  eventId?: string
} = {}): Promise<{
  events_considered: number
  jobs_created: number
  jobs_skipped: number
  correlation_model_version: string
  duration_ms: number
}> {
  const started = Date.now()
  const config = loadIncidentWorkerConfig()
  const metrics = {
    events_considered: 0,
    jobs_created: 0,
    jobs_skipped: 0,
    correlation_model_version: FIRE_INCIDENT_CORRELATION_MODEL_VERSION,
    duration_ms: 0,
  }

  if (!config.evaluationEnabled) {
    metrics.duration_ms = Date.now() - started
    return metrics
  }

  let candidates = await listFireEventCandidatesForIncidentCorrelation(options.limit ?? 10000)
  if (options.eventId) candidates = candidates.filter((c) => c.id === options.eventId)
  metrics.events_considered = candidates.length

  for (const event of candidates) {
    const active = await getActiveIncidentCorrelationJobForEvent(event.id)
    if (active && !options.force) {
      metrics.jobs_skipped += 1
      continue
    }

    const inserted = await insertIncidentCorrelationJob({
      event_id: event.id,
      requested_correlation_model_version: FIRE_INCIDENT_CORRELATION_MODEL_VERSION,
      max_attempts: config.maxAttempts,
    })
    if (inserted.created) metrics.jobs_created += 1
    else metrics.jobs_skipped += 1
  }

  metrics.duration_ms = Date.now() - started
  return metrics
}
