import { FIRE_MISSION_PROFILE_VERSION } from '@/modules/missions/config/fire-mission.config'
import { listMissionCandidatePlans } from '@/modules/missions/services/mission-plan-snapshot.loader'
import { loadMissionWorkerConfig } from '@/pipeline/config/mission-worker.config'
import {
  getActiveMissionCreationJobForPlan,
  insertMissionCreationJob,
} from '@/pipeline/stores/mission-creation-jobs.store'

export async function enqueueMissionCreationJobs(options: {
  limit?: number
  force?: boolean
  planId?: string
} = {}): Promise<{
  plans_considered: number
  jobs_created: number
  jobs_skipped: number
  mission_profile_version: string
  duration_ms: number
}> {
  const started = Date.now()
  const config = loadMissionWorkerConfig()
  const metrics = {
    plans_considered: 0,
    jobs_created: 0,
    jobs_skipped: 0,
    mission_profile_version: FIRE_MISSION_PROFILE_VERSION,
    duration_ms: 0,
  }

  if (!config.evaluationEnabled) {
    metrics.duration_ms = Date.now() - started
    return metrics
  }

  let candidates = await listMissionCandidatePlans(options.limit ?? 10000)
  if (options.planId) candidates = candidates.filter((c) => c.id === options.planId)
  metrics.plans_considered = candidates.length

  for (const plan of candidates) {
    const active = await getActiveMissionCreationJobForPlan(plan.id)
    if (active && !options.force) {
      metrics.jobs_skipped += 1
      continue
    }
    const inserted = await insertMissionCreationJob({
      verification_plan_id: plan.id,
      requested_mission_profile_version: FIRE_MISSION_PROFILE_VERSION,
      max_attempts: config.maxAttempts,
      priority: 10,
    })
    if (inserted.created) metrics.jobs_created += 1
    else metrics.jobs_skipped += 1
  }

  metrics.duration_ms = Date.now() - started
  return metrics
}
