import { randomUUID } from 'node:crypto'

import {
  loadMissionWorkerConfig,
  missionRetryBackoffMinutes,
} from '@/pipeline/config/mission-worker.config'
import { runMissionCreationForPlan } from '@/pipeline/engines/missions/mission-creation-evaluation.engine'
import {
  claimMissionCreationJob,
  completeMissionCreationJob,
  failMissionCreationJob,
  rescheduleMissionCreationJob,
  type MissionCreationJobRow,
} from '@/pipeline/stores/mission-creation-jobs.store'
import { withTimeout } from '@/pipeline/utils/timeout'

export class MissionCreationWorker {
  private readonly workerId: string
  private readonly config = loadMissionWorkerConfig()

  constructor(workerId?: string) {
    this.workerId = workerId ?? `mission-worker-${randomUUID().slice(0, 8)}`
  }

  private async processJob(
    job: MissionCreationJobRow,
  ): Promise<'completed' | 'rescheduled' | 'failed'> {
    const started = Date.now()
    try {
      await withTimeout(
        runMissionCreationForPlan(job.verification_plan_id),
        this.config.jobTimeoutMs,
        'mission_creation_job',
      )
      await completeMissionCreationJob(job.id)
      console.log(
        JSON.stringify({
          event: 'mission_creation_worker',
          job_id: job.id,
          verification_plan_id: job.verification_plan_id,
          result: 'completed',
          duration_ms: Date.now() - started,
        }),
      )
      return 'completed'
    } catch (err) {
      const message = (err instanceof Error ? err.message : 'mission creation failed').slice(
        0,
        240,
      )
      if (job.attempts < job.max_attempts) {
        const availableAt = new Date(
          Date.now() + missionRetryBackoffMinutes(job.attempts) * 60_000,
        ).toISOString()
        await rescheduleMissionCreationJob({
          jobId: job.id,
          availableAt,
          errorCode: 'mission_creation_failed',
          errorMessage: message,
        })
        return 'rescheduled'
      }
      await failMissionCreationJob({
        jobId: job.id,
        errorCode: 'mission_creation_failed',
        errorMessage: message,
      })
      return 'failed'
    }
  }

  async processOnce(): Promise<Record<string, number>> {
    const metrics = {
      jobs_claimed: 0,
      jobs_completed: 0,
      jobs_rescheduled: 0,
      jobs_failed: 0,
    }
    const job = await claimMissionCreationJob(this.workerId, this.config.lockTimeoutMinutes)
    if (!job) return metrics
    metrics.jobs_claimed = 1
    const result = await this.processJob(job)
    if (result === 'completed') metrics.jobs_completed = 1
    if (result === 'rescheduled') metrics.jobs_rescheduled = 1
    if (result === 'failed') metrics.jobs_failed = 1
    return metrics
  }

  async runUntilEmpty(maxRounds = 1000): Promise<Record<string, number>> {
    const totals = {
      jobs_claimed: 0,
      jobs_completed: 0,
      jobs_rescheduled: 0,
      jobs_failed: 0,
    }
    for (let round = 0; round < maxRounds; round += 1) {
      const metrics = await this.processOnce()
      totals.jobs_claimed += metrics.jobs_claimed
      totals.jobs_completed += metrics.jobs_completed
      totals.jobs_rescheduled += metrics.jobs_rescheduled
      totals.jobs_failed += metrics.jobs_failed
      if (metrics.jobs_claimed === 0) break
    }
    return totals
  }
}
