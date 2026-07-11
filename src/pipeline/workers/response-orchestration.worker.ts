import { randomUUID } from 'node:crypto'

import { RESPONSE_MODEL_VERSION } from '@/modules/response-orchestration/response-orchestration.types'
import { loadResponseOrchestrationWorkerConfig } from '@/pipeline/config/response-orchestration-worker.config'
import { runResponseAssessmentWithPersistence } from '@/pipeline/engines/response-orchestration/response-orchestration.runner.js'
import { buildResponseOrchestrationInputForIncident } from '@/pipeline/engines/response-orchestration/response-orchestration-input.builder.js'
import {
  claimResponseAssessmentJob,
  countResponseAssessmentJobsByStatus,
  releaseStaleResponseAssessmentJobLocks,
  updateResponseAssessmentJob,
} from '@/pipeline/stores/response-orchestration.store.js'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client.js'

const RETRY_MINUTES = 5

export interface ResponseOrchestrationWorkerHealth {
  status: 'healthy' | 'degraded' | 'stopped'
  worker_instance: string
  model_version: string
  last_heartbeat_at: string | null
  last_job_completed_at: string | null
  last_error: string | null
  jobs: Record<string, number>
  stale_locks_released: number
}

const healthState: ResponseOrchestrationWorkerHealth = {
  status: 'stopped',
  worker_instance: `response-orchestration-${process.pid}-${randomUUID().slice(0, 8)}`,
  model_version: RESPONSE_MODEL_VERSION,
  last_heartbeat_at: null,
  last_job_completed_at: null,
  last_error: null,
  jobs: {},
  stale_locks_released: 0,
}

export function getResponseOrchestrationWorkerHealth(): ResponseOrchestrationWorkerHealth {
  return { ...healthState, jobs: { ...healthState.jobs } }
}

export function markResponseOrchestrationWorkerStarted(): void {
  healthState.status = 'healthy'
  healthState.last_heartbeat_at = new Date().toISOString()
}

export function markResponseOrchestrationWorkerStopped(): void {
  healthState.status = 'stopped'
}

export class ResponseOrchestrationWorker {
  readonly workerId: string

  constructor(workerId?: string) {
    this.workerId = workerId ?? healthState.worker_instance
  }

  private touchHeartbeat(): void {
    healthState.last_heartbeat_at = new Date().toISOString()
  }

  async runOnce(): Promise<boolean> {
    const config = loadResponseOrchestrationWorkerConfig()
    this.touchHeartbeat()

    const released = await releaseStaleResponseAssessmentJobLocks(config.lockTimeoutMinutes)
    healthState.stale_locks_released += released

    const job = await claimResponseAssessmentJob(this.workerId)
    if (!job) {
      healthState.jobs = await countResponseAssessmentJobsByStatus()
      return false
    }

    const jobId = String(job.id)
    const incidentId = String(job.incident_id)
    const organizationId = String(job.organization_id)

    try {
      const pending = await getSupabaseAdmin()
        .from('resolution_reevaluation_requests')
        .select('id, status')
        .eq('incident_id', incidentId)
        .neq('status', 'completed')

      if ((pending.data ?? []).length > 0) {
        await updateResponseAssessmentJob(jobId, {
          status: 'waiting_dependencies',
          locked_at: null,
          locked_by: null,
          error_code: null,
        })
        healthState.last_error = null
        return true
      }

      const built = await buildResponseOrchestrationInputForIncident(incidentId, organizationId)
      if ('ownership_unresolved' in built) {
        await updateResponseAssessmentJob(jobId, {
          status: 'failed_terminal',
          error_code: 'ownership_unresolved',
          locked_at: null,
          locked_by: null,
        })
        healthState.last_error = 'ownership_unresolved'
        return true
      }

      const result = await runResponseAssessmentWithPersistence(built)
      if (!result.assessment) {
        const blocked = result.output.assessmentStatus === 'blocked_inconsistent_snapshot'
        await updateResponseAssessmentJob(jobId, {
          status: blocked ? 'blocked_inconsistent_snapshot' : 'failed_retryable',
          error_code: result.output.assessmentStatus,
          next_retry_at: blocked
            ? null
            : new Date(Date.now() + RETRY_MINUTES * 60_000).toISOString(),
          input_signature: result.output.inputSignature,
          locked_at: null,
          locked_by: null,
        })
        healthState.last_error = result.output.assessmentStatus
        return true
      }

      await updateResponseAssessmentJob(jobId, {
        status: 'completed',
        result_assessment_id: String(result.assessment.id),
        input_signature: result.output.inputSignature,
        error_code: null,
        locked_at: null,
        locked_by: null,
      })
      healthState.last_job_completed_at = new Date().toISOString()
      healthState.last_error = null
      return true
    } catch (err) {
      const attempts = Number(job.attempts ?? 1)
      const terminal = attempts >= Number(job.max_attempts ?? 5)
      const message = err instanceof Error ? err.message : 'unknown_error'
      await updateResponseAssessmentJob(jobId, {
        status: terminal ? 'failed_terminal' : 'failed_retryable',
        error_code: message,
        next_retry_at: terminal
          ? null
          : new Date(Date.now() + RETRY_MINUTES * 60_000).toISOString(),
        locked_at: null,
        locked_by: null,
      })
      healthState.last_error = message
      healthState.status = terminal ? 'degraded' : 'healthy'
      return true
    } finally {
      healthState.jobs = await countResponseAssessmentJobsByStatus()
    }
  }
}

export async function getResponseOrchestrationOperationalHealth(): Promise<ResponseOrchestrationWorkerHealth> {
  const jobs = await countResponseAssessmentJobsByStatus()
  const snapshot = getResponseOrchestrationWorkerHealth()
  snapshot.jobs = jobs
  const failed = (jobs.failed_retryable ?? 0) + (jobs.failed_terminal ?? 0) + (jobs.blocked_inconsistent_snapshot ?? 0)
  if (snapshot.status !== 'stopped' && failed > 0) snapshot.status = 'degraded'
  return snapshot
}
