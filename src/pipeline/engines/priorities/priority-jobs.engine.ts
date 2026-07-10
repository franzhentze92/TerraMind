import { loadPriorityWorkerConfig } from '@/pipeline/config/priority-worker.config'
import { resolvePriorityModelVersion } from '@/modules/priorities/services/fire-priority-context.loader'
import { getActivePriorityJobForEntity, insertPriorityJob } from '@/pipeline/stores/priority-jobs.store'
import { listFireEventCandidatesForPriority } from '@/pipeline/engines/priorities/priority-evaluation.engine'

export async function enqueuePriorityJobs(options: {
  limit?: number
  force?: boolean
  eventId?: string
} = {}): Promise<{
  events_considered: number
  jobs_created: number
  jobs_skipped: number
  priority_model_version: string
  duration_ms: number
}> {
  const started = Date.now()
  const config = loadPriorityWorkerConfig()
  const modelVersion = resolvePriorityModelVersion()
  const metrics = {
    events_considered: 0,
    jobs_created: 0,
    jobs_skipped: 0,
    priority_model_version: modelVersion,
    duration_ms: 0,
  }

  if (!config.evaluationEnabled) {
    metrics.duration_ms = Date.now() - started
    return metrics
  }

  let candidates = await listFireEventCandidatesForPriority(options.limit ?? 10000)
  if (options.eventId) candidates = candidates.filter((c) => c.id === options.eventId)
  metrics.events_considered = candidates.length

  for (const event of candidates) {
    const active = await getActivePriorityJobForEntity(event.id)
    if (active && !options.force) {
      metrics.jobs_skipped += 1
      continue
    }

    const inserted = await insertPriorityJob({
      entity_id: event.id,
      requested_priority_model_version: modelVersion,
      max_attempts: config.maxAttempts,
    })
    if (inserted.created) metrics.jobs_created += 1
    else metrics.jobs_skipped += 1
  }

  metrics.duration_ms = Date.now() - started
  return metrics
}

export async function enqueuePriorityJobForEntity(eventId: string): Promise<boolean> {
  const config = loadPriorityWorkerConfig()
  if (!config.evaluationEnabled) return false

  const active = await getActivePriorityJobForEntity(eventId)
  if (active) return false

  const inserted = await insertPriorityJob({
    entity_id: eventId,
    requested_priority_model_version: resolvePriorityModelVersion(),
    max_attempts: config.maxAttempts,
  })
  return inserted.created
}
