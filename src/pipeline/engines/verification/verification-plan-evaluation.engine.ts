import { genericVerificationPlanningEngine } from '@/modules/verification/engine/generic-verification-planning.engine'
import { loadIncidentVerificationSnapshot } from '@/modules/verification/services/fire-verification-snapshot.loader'
import type { VerificationPlanResult } from '@/modules/verification/verification.types'
import {
  getActiveVerificationPlan,
  persistVerificationPlan,
  supersedeActiveVerificationPlan,
} from '@/pipeline/stores/verification-plans.store'
import {
  hasVerificationPlanSignature,
  insertVerificationPlanEvaluationRun,
} from '@/pipeline/stores/verification-plan-runs.store'

export async function runVerificationPlanForIncident(
  incidentId: string,
): Promise<VerificationPlanResult | null> {
  const evaluatedAt = new Date().toISOString()
  const snapshot = await loadIncidentVerificationSnapshot(incidentId)
  if (!snapshot) return null

  const evaluation = genericVerificationPlanningEngine.evaluate({
    snapshot,
    evaluatedAt,
  })

  const duplicate = await hasVerificationPlanSignature(
    incidentId,
    evaluation.context_signature,
  )
  const activePlan = await getActiveVerificationPlan(
    incidentId,
    evaluation.verification_model_version,
  )

  if (duplicate && activePlan?.context_signature === evaluation.context_signature) {
    await insertVerificationPlanEvaluationRun({
      result: evaluation,
      planId: activePlan.id,
      warnings: ['duplicate_context_signature'],
    })
    return evaluation
  }

  let previousPlanId: string | null = null
  if (activePlan) {
    previousPlanId = await supersedeActiveVerificationPlan(
      incidentId,
      evaluation.verification_model_version,
    )
  }

  const planId = await persistVerificationPlan(evaluation, previousPlanId)
  await insertVerificationPlanEvaluationRun({ result: evaluation, planId })

  return evaluation
}
