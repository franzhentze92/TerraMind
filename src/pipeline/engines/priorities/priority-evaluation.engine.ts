import { firePriorityEngine } from '@/modules/priorities/engine/fire-priority.engine'
import {
  loadActiveFindingsForPriority,
  loadFirePriorityEvaluationContext,
  resolvePriorityModelVersion,
} from '@/modules/priorities/services/fire-priority-context.loader'
import {
  getActivePriorityAssessment,
  mapPriorityRowToAssessment,
  persistPriorityEvaluation,
} from '@/pipeline/stores/priority-assessments.store'
import type { PriorityEvaluationResult } from '@/modules/priorities/priorities.types'

export async function runPriorityEvaluationForEvent(
  eventId: string,
): Promise<PriorityEvaluationResult | null> {
  const event = await loadFirePriorityEvaluationContext(eventId)
  if (!event) return null

  const findings = await loadActiveFindingsForPriority(eventId)
  const modelVersion = resolvePriorityModelVersion()
  const previousRow = await getActivePriorityAssessment('fire_event', eventId, modelVersion)
  const previous = previousRow ? mapPriorityRowToAssessment(previousRow) : null

  const partial = firePriorityEngine.evaluateFireEventPriority({
    entity_type: 'fire_event',
    entity_id: eventId,
    event,
    findings,
    evaluated_at: new Date().toISOString(),
    previous_assessment: previous,
  })

  const persisted = await persistPriorityEvaluation(partial)

  return {
    ...partial,
    assessment: { ...partial.assessment, id: persisted.assessment_id },
    ...persisted,
  }
}

export async function listFireEventCandidatesForPriority(limit = 10000): Promise<
  Array<{ id: string; department_name: string | null }>
> {
  const { listFireEventCandidatesForFindings } = await import(
    '@/pipeline/engines/findings/finding-evaluation.engine'
  )
  return listFireEventCandidatesForFindings(limit)
}
