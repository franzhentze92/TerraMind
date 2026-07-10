import { ALL_RESOLUTION_PERMISSIONS } from '@/modules/verification/resolution/verification-resolution-permissions'
import { assertResolutionPermission } from '@/modules/verification/resolution/verification-resolution-permissions'
import {
  derivePlanResolution,
} from '@/modules/verification/resolution/verification-resolution.engine'
import { runNeedResolution } from '@/pipeline/engines/verification/verification-resolution.runner'
import {
  getActiveNeedResolution,
  listIncidentActiveResolutions,
  listNeedResolutionHistory,
  listPlanActiveResolutions,
  listPendingReevaluationRequests,
  listResolutionEvidenceLinks,
} from '@/pipeline/stores/verification-resolution.store'
import {
  getVerificationPlanById,
  listVerificationNeedsForPlan,
} from '@/pipeline/stores/verification-plans.store'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

function defaultPermissions() {
  return ALL_RESOLUTION_PERMISSIONS
}

export async function getNeedResolution(needId: string) {
  const resolution = await getActiveNeedResolution(needId)
  if (!resolution) return null
  const links = await listResolutionEvidenceLinks(resolution.id as string)
  return { resolution, evidence_links: links }
}

export async function getNeedResolutionHistory(needId: string) {
  const items = await listNeedResolutionHistory(needId)
  return { items, generated_at: new Date().toISOString() }
}

export async function getPlanResolutionSummary(planId: string) {
  const plan = await getVerificationPlanById(planId)
  if (!plan) return null

  const needs = await listVerificationNeedsForPlan(planId)
  const resolutions = await listPlanActiveResolutions(planId)
  const resolutionByNeed = new Map(resolutions.map((r) => [String(r.verification_need_id), r]))

  const needResults = needs.map((n) => {
    const res = resolutionByNeed.get(String(n.id))
    return {
      need_id: String(n.id),
      need_type: String(n.need_type),
      status: res ? String(res.resolution_status) : String(n.resolution_status ?? 'open'),
      resolution: res ?? null,
    }
  })

  const summary = derivePlanResolution(
    planId,
    needResults.map((n) => ({
      need_id: n.need_id,
      need_type: n.need_type,
      status: n.status as import('@/modules/verification/resolution/verification-resolution.types').NeedResolutionStatus,
    })),
  )

  return {
    plan_id: planId,
    plan_status: plan.status,
    derived_status: summary.derived_status,
    summary,
    needs: needResults,
    generated_at: new Date().toISOString(),
  }
}

export async function getIncidentVerificationResolution(incidentId: string) {
  const supabase = getSupabaseAdmin()
  const { data: plans, error } = await supabase
    .from('verification_plans')
    .select('id, status')
    .eq('incident_id', incidentId)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw new Error(error.message)

  const plan = plans?.[0]
  const resolutions = await listIncidentActiveResolutions(incidentId)
  const pendingEffects = await listPendingReevaluationRequests(incidentId)

  const counts = {
    satisfied: 0,
    partially_satisfied: 0,
    inconclusive: 0,
    open: 0,
    insufficient_evidence: 0,
    conflicting_evidence: 0,
  }
  for (const r of resolutions) {
    const s = String(r.resolution_status)
    if (s in counts) counts[s as keyof typeof counts] += 1
  }

  const keyEvidence = resolutions
    .flatMap((r) => {
      const bundle = r.evidence_bundle as { validations_used?: string[]; combined_strength?: string }
      return (bundle.validations_used ?? []).map((v) => ({
        resolution_id: r.id,
        validation_id: v,
        strength: bundle.combined_strength,
        need_id: r.verification_need_id,
      }))
    })
    .slice(0, 10)

  return {
    incident_id: incidentId,
    plan_id: plan?.id ?? null,
    plan_status: plan?.status ?? null,
    resolution_counts: counts,
    resolutions,
    key_evidence: keyEvidence,
    pending_reevaluations: pendingEffects,
    generated_at: new Date().toISOString(),
  }
}

export async function reEvaluateVerificationNeed(
  needId: string,
  input: { actor_id?: string | null; idempotency_key?: string | null },
) {
  assertResolutionPermission(defaultPermissions(), 're_evaluate')
  if (!input.idempotency_key) {
    throw new Error('idempotency_key es requerido')
  }

  const result = await runNeedResolution(needId, {
    idempotencyKey: input.idempotency_key,
    force: true,
  })
  return { ok: true, ...result }
}

export async function getMissionResolutionContributions(missionId: string) {
  const { listMissionResolutionContributions } = await import(
    '@/pipeline/stores/verification-resolution.store'
  )
  const contributions = await listMissionResolutionContributions(missionId)
  return { items: contributions, generated_at: new Date().toISOString() }
}
