import { loadLifecycleWorkerConfig } from '@/pipeline/config/lifecycle-worker.config'
import { FIRE_LIFECYCLE_MODEL_VERSION } from '@/modules/lifecycle/config/fire-lifecycle.config'
import { getActiveLifecycleJobForEntity, insertLifecycleJob } from '@/pipeline/stores/lifecycle-jobs.store'
import { listFireEventCandidatesForLifecycle } from '@/modules/lifecycle/services/fire-lifecycle-snapshot.loader'

export async function enqueueLifecycleJobs(options: {
  limit?: number
  force?: boolean
  eventId?: string
} = {}): Promise<{
  events_considered: number
  jobs_created: number
  jobs_skipped: number
  lifecycle_model_version: string
  duration_ms: number
}> {
  const started = Date.now()
  const config = loadLifecycleWorkerConfig()
  const metrics = {
    events_considered: 0,
    jobs_created: 0,
    jobs_skipped: 0,
    lifecycle_model_version: FIRE_LIFECYCLE_MODEL_VERSION,
    duration_ms: 0,
  }

  if (!config.evaluationEnabled) {
    metrics.duration_ms = Date.now() - started
    return metrics
  }

  let candidates = await listFireEventCandidatesForLifecycle(options.limit ?? 10000)
  if (options.eventId) candidates = candidates.filter((c) => c.id === options.eventId)
  metrics.events_considered = candidates.length

  for (const event of candidates) {
    const active = await getActiveLifecycleJobForEntity(event.id)
    if (active && !options.force) {
      metrics.jobs_skipped += 1
      continue
    }

    const inserted = await insertLifecycleJob({
      entity_id: event.id,
      requested_lifecycle_model_version: FIRE_LIFECYCLE_MODEL_VERSION,
      max_attempts: config.maxAttempts,
    })
    if (inserted.created) metrics.jobs_created += 1
    else metrics.jobs_skipped += 1
  }

  metrics.duration_ms = Date.now() - started
  return metrics
}

export async function enqueueLifecycleJobForEntity(eventId: string): Promise<boolean> {
  const config = loadLifecycleWorkerConfig()
  if (!config.evaluationEnabled) return false

  const active = await getActiveLifecycleJobForEntity(eventId)
  if (active) return false

  const inserted = await insertLifecycleJob({
    entity_id: eventId,
    requested_lifecycle_model_version: FIRE_LIFECYCLE_MODEL_VERSION,
    max_attempts: config.maxAttempts,
  })
  return inserted.created
}
