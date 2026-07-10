import { genericLifecycleEngine } from '@/modules/lifecycle/engine/generic-lifecycle.engine'
import { loadFireLifecycleSnapshot } from '@/modules/lifecycle/services/fire-lifecycle-snapshot.loader'
import {
  shouldEnqueueFindingReevaluation,
  shouldEnqueuePriorityReevaluation,
  shouldExpirePriorityQueue,
  syncFindingsWithLifecycleState,
} from '@/modules/lifecycle/sync/lifecycle-findings-sync'
import type { LifecycleEvaluationResult } from '@/modules/lifecycle/lifecycle.types'
import {
  getLatestLifecycleTransition,
  insertLifecycleEvaluationRun,
  persistLifecycleEvaluation,
} from '@/pipeline/stores/lifecycle-transitions.store'
import { expireActivePriorityAssessment } from '@/pipeline/stores/priority-assessments.store'
import { resolvePriorityModelVersion } from '@/modules/priorities/services/fire-priority-context.loader'

export async function runLifecycleEvaluationForEvent(
  eventId: string,
): Promise<LifecycleEvaluationResult | null> {
  const snapshot = await loadFireLifecycleSnapshot(eventId)
  if (!snapshot) return null

  const evaluatedAt = new Date().toISOString()
  const evaluation = genericLifecycleEngine.evaluate({ snapshot, evaluatedAt })
  const previousTransition = await getLatestLifecycleTransition('fire_event', eventId)

  const persist = await persistLifecycleEvaluation(evaluation, previousTransition)
  if (persist.skipped_duplicate) {
    await insertLifecycleEvaluationRun({
      evaluation,
      transition_id: null,
      findings_jobs_enqueued: 0,
      priority_jobs_enqueued: 0,
      findings_synced: 0,
      warnings: ['duplicate_context_signature'],
    })
    return evaluation
  }

  let findingsSynced = 0
  let findingsJobsEnqueued = 0
  let priorityJobsEnqueued = 0
  const warnings: string[] = [...evaluation.warnings]

  if (evaluation.transitioned || evaluation.new_state !== evaluation.previous_state) {
    findingsSynced = await syncFindingsWithLifecycleState(eventId, evaluation.new_state)
  }

  if (shouldEnqueueFindingReevaluation(evaluation.new_state)) {
    const { enqueueFindingJobForEntity } = await import(
      '@/pipeline/engines/findings/finding-jobs.engine'
    )
    const created = await enqueueFindingJobForEntity(eventId)
    if (created) findingsJobsEnqueued = 1
  }

  if (shouldExpirePriorityQueue(evaluation.new_state)) {
    await expireActivePriorityAssessment(
      'fire_event',
      eventId,
      resolvePriorityModelVersion(),
    )
  } else if (shouldEnqueuePriorityReevaluation(evaluation.new_state)) {
    const { enqueuePriorityJobForEntity } = await import(
      '@/pipeline/engines/priorities/priority-jobs.engine'
    )
    const created = await enqueuePriorityJobForEntity(eventId)
    if (created) priorityJobsEnqueued = 1
  }

  await insertLifecycleEvaluationRun({
    evaluation,
    transition_id: persist.transition_id,
    findings_jobs_enqueued: findingsJobsEnqueued,
    priority_jobs_enqueued: priorityJobsEnqueued,
    findings_synced: findingsSynced,
    warnings,
  })

  return evaluation
}
