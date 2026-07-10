import { genericMissionsCoreEngine } from '@/modules/missions/engine/generic-missions.engine'
import { loadMissionPlanSnapshot } from '@/modules/missions/services/mission-plan-snapshot.loader'
import type { MissionCreationResult } from '@/modules/missions/missions.types'
import {
  getActiveEquivalentMission,
  getMissionByContextSignature,
  persistMissionBundle,
} from '@/pipeline/stores/missions.store'
import {
  hasMissionCreationSignature,
  insertMissionCreationEvaluationRun,
} from '@/pipeline/stores/mission-creation-runs.store'

export async function runMissionCreationForPlan(
  planId: string,
): Promise<MissionCreationResult | null> {
  const evaluatedAt = new Date().toISOString()
  const plan = await loadMissionPlanSnapshot(planId)
  if (!plan) return null

  const blockedMethodIds = new Set(
    plan.needs
      .filter((n) => n.is_blocked && n.recommended_method_id)
      .map((n) => n.recommended_method_id as string),
  )

  const evaluation = genericMissionsCoreEngine.evaluate({
    plan,
    blockedMethodIds,
    evaluatedAt,
  })

  const duplicate = await hasMissionCreationSignature(planId, evaluation.context_signature)
  const existingBySignature = await getMissionByContextSignature(
    planId,
    evaluation.context_signature,
  )

  if (duplicate || existingBySignature) {
    evaluation.decision = 'duplicate_exists'
    await insertMissionCreationEvaluationRun({
      result: evaluation,
      missionId: existingBySignature?.id ?? null,
      warnings: ['duplicate_context_signature'],
    })
    return evaluation
  }

  if (evaluation.decision !== 'create_mission') {
    await insertMissionCreationEvaluationRun({ result: evaluation, missionId: null })
    return evaluation
  }

  const ext = evaluation as MissionCreationResult & Record<string, unknown>
  if (ext.primary_verification_need_id && ext.recommended_method_code) {
    const equivalent = await getActiveEquivalentMission({
      incidentId: evaluation.incident_id,
      verificationPlanId: evaluation.verification_plan_id,
      primaryNeedId: String(ext.primary_verification_need_id),
      methodCode: String(ext.recommended_method_code),
      profileVersion: evaluation.mission_profile_version,
    })
    if (equivalent) {
      evaluation.decision = 'duplicate_exists'
      await insertMissionCreationEvaluationRun({
        result: evaluation,
        missionId: equivalent.id,
        warnings: ['active_equivalent_mission_exists'],
      })
      return evaluation
    }
  }

  const missionId = await persistMissionBundle(ext)
  evaluation.mission_id = missionId
  await insertMissionCreationEvaluationRun({ result: evaluation, missionId })
  return evaluation
}
