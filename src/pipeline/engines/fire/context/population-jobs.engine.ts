import { loadPopulationWorkerConfig } from '@/pipeline/config/population-worker.config'
import {
  eventNeedsPopulationEnrichment,
  PopulationSourceUnavailableError,
  resolvePopulationRuntime,
} from '@/pipeline/engines/fire/context/population.engine'
import {
  getActivePopulationJobForEvent,
  insertPopulationJob,
} from '@/pipeline/stores/population-jobs.store'
import {
  listPopulationEventCandidates,
  type PopulationEventCandidate,
} from '@/pipeline/stores/population.store'

export interface EnqueuePopulationJobsOptions {
  limit?: number
  force?: boolean
  eventId?: string
}

export interface EnqueuePopulationJobsMetrics {
  events_considered: number
  jobs_created: number
  jobs_skipped: number
  events_unchanged: number
  context_version: string | null
  duration_ms: number
}

export function eventQualifiesForPopulationJob(
  event: PopulationEventCandidate,
  contextVersion: string,
  force: boolean,
): boolean {
  if (force) return true
  if (event.status === 'closed' && !eventNeedsPopulationEnrichment(event, contextVersion, false)) {
    return false
  }
  return eventNeedsPopulationEnrichment(event, contextVersion, false)
}

export async function enqueuePopulationJobs(
  options: EnqueuePopulationJobsOptions = {},
): Promise<EnqueuePopulationJobsMetrics> {
  const started = Date.now()
  const config = loadPopulationWorkerConfig()
  const metrics: EnqueuePopulationJobsMetrics = {
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

  let runtime
  try {
    runtime = await resolvePopulationRuntime()
  } catch (err) {
    if (err instanceof PopulationSourceUnavailableError) {
      metrics.duration_ms = Date.now() - started
      return metrics
    }
    throw err
  }

  metrics.context_version = runtime.contextVersion
  let candidates = await listPopulationEventCandidates(options.limit ?? 10000)
  if (options.eventId) candidates = candidates.filter((c) => c.id === options.eventId)
  metrics.events_considered = candidates.length

  const eligible = candidates.filter((event) =>
    eventQualifiesForPopulationJob(event, runtime.contextVersion, options.force ?? false),
  )
  metrics.events_unchanged = candidates.length - eligible.length

  for (const event of eligible) {
    const active = await getActivePopulationJobForEvent(event.id)
    if (active) {
      metrics.jobs_skipped += 1
      continue
    }

    const inserted = await insertPopulationJob({
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
