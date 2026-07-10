import { loadBiodiversityWorkerConfig } from '@/pipeline/config/biodiversity-worker.config'
import {
  eventNeedsBiodiversityEnrichment,
  resolveBiodiversityRuntime,
} from '@/pipeline/engines/fire/context/biodiversity.engine'
import {
  getActiveBiodiversityJobForEvent,
  insertBiodiversityJob,
} from '@/pipeline/stores/biodiversity-jobs.store'
import {
  listBiodiversityEventCandidates,
  type BiodiversityEventCandidate,
} from '@/pipeline/stores/biodiversity-event.store'

export interface EnqueueBiodiversityJobsOptions {
  limit?: number
  force?: boolean
  eventId?: string
}

export interface EnqueueBiodiversityJobsMetrics {
  events_considered: number
  jobs_created: number
  jobs_skipped: number
  events_unchanged: number
  context_version: string | null
  duration_ms: number
}

export function eventQualifiesForBiodiversityJob(
  event: BiodiversityEventCandidate,
  contextVersion: string,
  force: boolean,
): boolean {
  if (force) return true
  return eventNeedsBiodiversityEnrichment(event, contextVersion, false)
}

export async function enqueueBiodiversityJobs(
  options: EnqueueBiodiversityJobsOptions = {},
): Promise<EnqueueBiodiversityJobsMetrics> {
  const started = Date.now()
  const config = loadBiodiversityWorkerConfig()
  const metrics: EnqueueBiodiversityJobsMetrics = {
    events_considered: 0,
    jobs_created: 0,
    jobs_skipped: 0,
    events_unchanged: 0,
    context_version: null,
    duration_ms: 0,
  }

  if (!config.enrichmentEnabled) {
    metrics.duration_ms = Date.now() - started
    return metrics
  }

  const runtime = resolveBiodiversityRuntime()
  metrics.context_version = runtime.contextVersion

  let candidates = await listBiodiversityEventCandidates(options.limit ?? 10000)
  if (options.eventId) candidates = candidates.filter((c) => c.id === options.eventId)
  metrics.events_considered = candidates.length

  const eligible = candidates.filter((event) =>
    eventQualifiesForBiodiversityJob(event, runtime.contextVersion, options.force ?? false),
  )
  metrics.events_unchanged = candidates.length - eligible.length

  for (const event of eligible) {
    const active = await getActiveBiodiversityJobForEvent(event.id)
    if (active) {
      metrics.jobs_skipped += 1
      continue
    }

    const inserted = await insertBiodiversityJob({
      entity_id: event.id,
      requested_context_version: runtime.contextVersion,
      max_attempts: config.maxAttempts,
    })

    if (inserted.created) metrics.jobs_created += 1
    else metrics.jobs_skipped += 1
  }

  metrics.duration_ms = Date.now() - started
  return metrics
}
