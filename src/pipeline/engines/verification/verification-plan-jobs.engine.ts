import { FIRE_VERIFICATION_MODEL_VERSION } from '@/modules/verification/config/fire-verification.config'
import { listIncidentCandidatesForVerification } from '@/modules/verification/services/fire-verification-snapshot.loader'
import { loadVerificationWorkerConfig } from '@/pipeline/config/verification-worker.config'
import {
  getActiveVerificationPlanJobForIncident,
  insertVerificationPlanJob,
} from '@/pipeline/stores/verification-plan-jobs.store'

export async function enqueueVerificationPlanJobs(options: {
  limit?: number
  force?: boolean
  incidentId?: string
} = {}): Promise<{
  incidents_considered: number
  jobs_created: number
  jobs_skipped: number
  verification_model_version: string
  duration_ms: number
}> {
  const started = Date.now()
  const config = loadVerificationWorkerConfig()
  const metrics = {
    incidents_considered: 0,
    jobs_created: 0,
    jobs_skipped: 0,
    verification_model_version: FIRE_VERIFICATION_MODEL_VERSION,
    duration_ms: 0,
  }

  if (!config.evaluationEnabled) {
    metrics.duration_ms = Date.now() - started
    return metrics
  }

  let candidates = await listIncidentCandidatesForVerification(options.limit ?? 10000)
  if (options.incidentId) {
    candidates = candidates.filter((c) => c.id === options.incidentId)
  }
  metrics.incidents_considered = candidates.length

  for (const incident of candidates) {
    const active = await getActiveVerificationPlanJobForIncident(incident.id)
    if (active && !options.force) {
      metrics.jobs_skipped += 1
      continue
    }

    const inserted = await insertVerificationPlanJob({
      incident_id: incident.id,
      requested_verification_model_version: FIRE_VERIFICATION_MODEL_VERSION,
      max_attempts: config.maxAttempts,
    })
    if (inserted.created) metrics.jobs_created += 1
    else metrics.jobs_skipped += 1
  }

  metrics.duration_ms = Date.now() - started
  return metrics
}
