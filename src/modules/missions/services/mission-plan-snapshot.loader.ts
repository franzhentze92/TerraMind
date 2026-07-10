import type { MissionPlanSnapshot } from '@/modules/missions/missions.types'
import {
  getVerificationPlanById,
  listMethodCandidatesForPlan,
  listVerificationNeedsForPlan,
} from '@/pipeline/stores/verification-plans.store'
import { getIncidentById } from '@/pipeline/stores/incidents.store'

export async function loadMissionPlanSnapshot(
  planId: string,
): Promise<MissionPlanSnapshot | null> {
  const plan = await getVerificationPlanById(planId)
  if (!plan) return null

  const needs = await listVerificationNeedsForPlan(planId)
  const methods = await listMethodCandidatesForPlan(planId)
  const incident = await getIncidentById(plan.incident_id)
  const snapshot = plan.incident_snapshot as MissionPlanSnapshot['incident_snapshot']

  return {
    id: plan.id,
    incident_id: plan.incident_id,
    status: plan.status,
    plan_priority: plan.plan_priority,
    mission_candidate_pending: plan.mission_candidate_pending,
    context_signature: plan.context_signature,
    recommended_window: plan.recommended_window as MissionPlanSnapshot['recommended_window'],
    incident_snapshot: {
      ...snapshot,
      incident_status: incident?.status ?? snapshot.incident_status,
      centroid_lat: incident?.centroid_lat ?? snapshot.centroid_lat,
      centroid_lng: incident?.centroid_lng ?? snapshot.centroid_lng,
    },
    needs: needs.map((n) => {
      const recommended = methods.find(
        (m) => m.need_id === n.id && m.is_recommended,
      )
      return {
        id: String(n.id),
        need_type: String(n.need_type),
        need_question: String(n.need_question),
        priority: Number(n.priority),
        recommended_method_id: n.recommended_method_id
          ? String(n.recommended_method_id)
          : recommended
            ? String(recommended.method_id)
            : null,
        recommended_window: (n.recommended_window as { hours?: number }) ?? {},
        evidence_minimum: (n.evidence_minimum as string[]) ?? [],
        success_criteria: n.success_criteria as { text?: string },
        inconclusive_criteria: n.inconclusive_criteria as { text?: string },
        failure_criteria: n.failure_criteria as { text?: string },
        is_blocked: recommended?.is_blocked ?? false,
      }
    }),
  }
}

export async function listMissionCandidatePlans(limit = 10000): Promise<Array<{ id: string }>> {
  const { getSupabaseAdmin } = await import('@/pipeline/stores/supabase.client')
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('verification_plans')
    .select('id')
    .eq('status', 'ready')
    .eq('mission_candidate_pending', true)
    .order('plan_priority', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({ id: String(r.id) }))
}
