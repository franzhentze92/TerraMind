import { loadLandCoverWorkerConfig } from '@/pipeline/config/land-cover-worker.config'
import {
  eventNeedsLandCoverEnrichment,
  LandCoverSourceUnavailableError,
  resolveLandCoverRuntime,
} from '@/pipeline/engines/fire/context/land-cover.engine'
import {
  getActiveLandCoverJobForEvent,
  insertLandCoverJob,
} from '@/pipeline/stores/land-cover-jobs.store'
import {
  listLandCoverEventCandidates,
  type LandCoverEventCandidate,
} from '@/pipeline/stores/land-cover.store'

export interface EnqueueLandCoverJobsOptions {
  limit?: number
  force?: boolean
  eventId?: string
}

export interface EnqueueLandCoverJobsMetrics {
  events_considered: number
  jobs_created: number
  jobs_skipped: number
  events_unchanged: number
  context_version: string | null
  duration_ms: number
}

export function eventQualifiesForLandCoverJob(
  event: LandCoverEventCandidate,
  contextVersion: string,
  force: boolean,
): boolean {
  if (force) return true
  if (
    event.status === 'closed' &&
    !eventNeedsLandCoverEnrichment(event, contextVersion, false)
  ) {
    return false
  }
  return eventNeedsLandCoverEnrichment(event, contextVersion, false)
}

export async function enqueueLandCoverJobs(
  options: EnqueueLandCoverJobsOptions = {},
): Promise<EnqueueLandCoverJobsMetrics> {
  const started = Date.now()
  const config = loadLandCoverWorkerConfig()
  const limit = options.limit ?? 10000
  const force = options.force ?? false

  const metrics: EnqueueLandCoverJobsMetrics = {
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
    runtime = await resolveLandCoverRuntime()
  } catch (err) {
    if (err instanceof LandCoverSourceUnavailableError) {
      metrics.duration_ms = Date.now() - started
      return metrics
    }
    throw err
  }

  metrics.context_version = runtime.contextVersion

  let candidates = await listLandCoverEventCandidates(limit)
  if (options.eventId) {
    candidates = candidates.filter((c) => c.id === options.eventId)
  }
  metrics.events_considered = candidates.length

  const eligible = candidates.filter((event) =>
    eventQualifiesForLandCoverJob(event, runtime.contextVersion, force),
  )
  metrics.events_unchanged = candidates.length - eligible.length

  for (const event of eligible) {
    const active = await getActiveLandCoverJobForEvent(event.id)
    if (active) {
      metrics.jobs_skipped += 1
      continue
    }

    const inserted = await insertLandCoverJob({
      event_id: event.id,
      requested_context_version: runtime.contextVersion,
      max_attempts: config.maxAttempts,
    })

    if (inserted.created) {
      metrics.jobs_created += 1
    } else {
      metrics.jobs_skipped += 1
    }
  }

  metrics.duration_ms = Date.now() - started
  return metrics
}
