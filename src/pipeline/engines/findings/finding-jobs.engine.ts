import { loadFindingWorkerConfig } from '@/pipeline/config/finding-worker.config'
import { resolveFindingRuleSetVersion } from '@/pipeline/engines/findings/finding-evaluation.engine'
import { getActiveFindingJobForEntity, insertFindingJob } from '@/pipeline/stores/finding-jobs.store'
import { listFireEventCandidatesForFindings } from '@/pipeline/engines/findings/finding-evaluation.engine'

export async function enqueueFindingJobs(options: {
  limit?: number
  force?: boolean
  eventId?: string
} = {}): Promise<{
  events_considered: number
  jobs_created: number
  jobs_skipped: number
  rule_set_version: string
  duration_ms: number
}> {
  const started = Date.now()
  const config = loadFindingWorkerConfig()
  const ruleSetVersion = resolveFindingRuleSetVersion()
  const metrics = {
    events_considered: 0,
    jobs_created: 0,
    jobs_skipped: 0,
    rule_set_version: ruleSetVersion,
    duration_ms: 0,
  }

  if (!config.evaluationEnabled) {
    metrics.duration_ms = Date.now() - started
    return metrics
  }

  let candidates = await listFireEventCandidatesForFindings(options.limit ?? 10000)
  if (options.eventId) candidates = candidates.filter((c) => c.id === options.eventId)
  metrics.events_considered = candidates.length

  for (const event of candidates) {
    const active = await getActiveFindingJobForEntity(event.id)
    if (active && !options.force) {
      metrics.jobs_skipped += 1
      continue
    }

    const inserted = await insertFindingJob({
      entity_id: event.id,
      requested_rule_set_version: ruleSetVersion,
      max_attempts: config.maxAttempts,
    })
    if (inserted.created) metrics.jobs_created += 1
    else metrics.jobs_skipped += 1
  }

  metrics.duration_ms = Date.now() - started
  return metrics
}

export async function enqueueFindingJobForEntity(eventId: string): Promise<boolean> {
  const config = loadFindingWorkerConfig()
  if (!config.evaluationEnabled) return false

  const active = await getActiveFindingJobForEntity(eventId)
  if (active) return false

  const inserted = await insertFindingJob({
    entity_id: eventId,
    requested_rule_set_version: resolveFindingRuleSetVersion(),
    max_attempts: config.maxAttempts,
  })
  return inserted.created
}
