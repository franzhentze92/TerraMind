import { loadClimateWorkerConfig } from '@/pipeline/config/climate-worker.config'
import {
  eventNeedsClimateEnrichment,
  resolveClimateRuntime,
} from '@/pipeline/engines/fire/context/climate.engine'
import { getActiveClimateJobForEvent, insertClimateJob } from '@/pipeline/stores/climate-jobs.store'
import { listClimateEventCandidates, type ClimateEventCandidate } from '@/pipeline/stores/climate.store'

export interface EnqueueClimateJobsOptions {
  limit?: number
  force?: boolean
  eventId?: string
}

export interface EnqueueClimateJobsMetrics {
  events_considered: number
  jobs_created: number
  jobs_skipped: number
  events_unchanged: number
  context_version: string | null
  duration_ms: number
}

export function eventQualifiesForClimateJob(
  event: ClimateEventCandidate,
  contextVersion: string,
  force: boolean,
): boolean {
  if (force) return true
  if (event.status === 'closed' && !eventNeedsClimateEnrichment(event, contextVersion, false)) {
    return false
  }
  return eventNeedsClimateEnrichment(event, contextVersion, false)
}

export async function enqueueClimateJobs(
  options: EnqueueClimateJobsOptions = {},
): Promise<EnqueueClimateJobsMetrics> {
  const started = Date.now()
  const config = loadClimateWorkerConfig()
  const metrics: EnqueueClimateJobsMetrics = {
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

  const runtime = resolveClimateRuntime()
  metrics.context_version = runtime.contextVersion

  let candidates = await listClimateEventCandidates(options.limit ?? 10000)
  if (options.eventId) candidates = candidates.filter((c) => c.id === options.eventId)
  metrics.events_considered = candidates.length

  const eligible = candidates.filter((event) =>
    eventQualifiesForClimateJob(event, runtime.contextVersion, options.force ?? false),
  )
  metrics.events_unchanged = candidates.length - eligible.length

  for (const event of eligible) {
    const active = await getActiveClimateJobForEvent(event.id)
    if (active) {
      metrics.jobs_skipped += 1
      continue
    }

    const inserted = await insertClimateJob({
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
