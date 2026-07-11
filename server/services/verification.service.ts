import type { RequestAuthContext } from '@/core/auth/permissions'
import { FIRE_VERIFICATION_MODEL_VERSION } from '@/modules/verification/config/fire-verification.config'
import { FIRE_VERIFICATION_METHOD_CATALOG } from '@/modules/verification/config/fire-verification.config'
import {
  getActiveVerificationPlan,
  getVerificationPlanById,
  listMethodCandidatesForPlan,
  listVerificationNeedsForPlan,
  listVerificationPlans,
} from '@/pipeline/stores/verification-plans.store'
import { getIncidentById } from '@/pipeline/stores/incidents.store'
import { filterRowsByActiveOrganization } from '../auth/tenant-list-scope.js'
import { buildIncidentDisplayName } from '@/modules/incidents/utils/incident-display-name'
import { isInternalDemoIncidentId } from '@/modules/executive-demo/demo-config'

function classifyPlanIncident(
  incidentId: string,
  incident: { id: string; organization_id?: string | null } | null,
): 'operational' | 'legacy' | 'demo' {
  if (isInternalDemoIncidentId(incidentId)) return 'demo'
  if (!incident) return 'legacy'
  if ((incident.organization_id ?? null) == null) return 'legacy'
  return 'operational'
}

/** Pick the most operationally relevant lifecycle state among snapshot members. */
function dominantLifecycleState(members: unknown): string | null {
  if (!Array.isArray(members)) return null
  const states = members
    .map((m) => (m as { lifecycle_state?: string | null }).lifecycle_state)
    .filter((s): s is string => Boolean(s))
  if (states.length === 0) return null
  const priority = ['expanding', 'persistent', 'reactivated', 'active', 'declining']
  for (const p of priority) {
    const hit = states.find((s) => s.replace(/^lifecycle_/, '') === p)
    if (hit) return hit
  }
  return states[0]
}

export async function listVerificationPlansDto(
  filters: {
  status?: string
  plan_priority?: number
  recommended_method?: string
  requires_field?: boolean
  requires_external?: boolean
  domain?: string
  blocked?: boolean
  limit?: number
  },
  auth?: RequestAuthContext,
) {
  const rows = await listVerificationPlans({
    status: filters.status,
    domain: filters.domain,
    min_priority: filters.plan_priority,
    limit: filters.limit ?? 100,
  })
  const scoped = auth
    ? filterRowsByActiveOrganization(auth, rows as Array<{ organization_id?: string | null }>)
    : rows

  const items = []
  for (const plan of scoped) {
    const incident = await getIncidentById(plan.incident_id)
    const needs = await listVerificationNeedsForPlan(plan.id)
    const methods = await listMethodCandidatesForPlan(plan.id)

    const primaryNeed = needs[0]
    const recommendedMethodId = primaryNeed?.recommended_method_id ?? null
    const methodDef = recommendedMethodId
      ? FIRE_VERIFICATION_METHOD_CATALOG.find((m) => m.method_id === recommendedMethodId)
      : null

    if (filters.recommended_method && recommendedMethodId !== filters.recommended_method) continue
    if (filters.requires_field === true && !methodDef?.requires_field_presence) continue
    if (filters.requires_field === false && methodDef?.requires_field_presence) continue
    if (filters.requires_external === true && !methodDef?.requires_external_provider) continue
    if (filters.requires_external === false && methodDef?.requires_external_provider) continue
    if (filters.blocked === true && plan.status !== 'blocked') continue
    if (filters.blocked === false && plan.status === 'blocked') continue

    const snapshot = (plan.incident_snapshot ?? {}) as {
      incident_type?: string
      status?: string
      incident_status?: string
      domain?: string
      event_count?: number
      members?: unknown
    }
    const resolvedType = incident?.incident_type ?? snapshot.incident_type ?? null
    const resolvedStatus = incident?.status ?? snapshot.incident_status ?? snapshot.status ?? null
    const resolvedEventCount = incident?.event_count ?? snapshot.event_count ?? 1
    const resolvedLifecycle = incident?.lifecycle_state ?? dominantLifecycleState(snapshot.members)

    items.push({
      id: plan.id,
      incident_id: plan.incident_id,
      incident_status: incident?.status ?? snapshot.incident_status ?? null,
      incident_type: resolvedType,
      incident_display_name: resolvedType
        ? buildIncidentDisplayName({
            incident_type: String(resolvedType),
            status: resolvedStatus ? String(resolvedStatus) : undefined,
            event_count: Number(resolvedEventCount),
            lifecycle_state: resolvedLifecycle ?? undefined,
          })
        : null,
      classification: classifyPlanIncident(plan.incident_id, incident),
      domain: incident?.domain ?? (plan.incident_snapshot as { domain?: string }).domain,
      status: plan.status,
      plan_priority: plan.plan_priority,
      primary_need_type: primaryNeed?.need_type ?? null,
      primary_need_question: primaryNeed?.need_question ?? null,
      recommended_method_id: recommendedMethodId,
      recommended_method_label: methodDef?.label ?? null,
      requires_field: methodDef?.requires_field_presence ?? false,
      requires_external_provider: methodDef?.requires_external_provider ?? false,
      recommended_window: plan.recommended_window,
      needs_count: needs.length,
      methods_count: methods.length,
      mission_candidate_pending: plan.mission_candidate_pending,
      created_at: plan.created_at,
      updated_at: plan.updated_at,
    })
  }

  return { items, generated_at: new Date().toISOString() }
}

export async function getVerificationPlanDetail(id: string) {
  const plan = await getVerificationPlanById(id)
  if (!plan) return null
  const needs = await listVerificationNeedsForPlan(plan.id)
  const methods = await listMethodCandidatesForPlan(plan.id)
  const incident = await getIncidentById(plan.incident_id)

  return {
    ...plan,
    incident_status: incident?.status ?? null,
    needs: needs.map((n) => ({
      ...n,
      methods: methods.filter((m) => m.need_id === n.id),
    })),
    generated_at: new Date().toISOString(),
  }
}

export async function getIncidentVerificationPlan(incidentId: string) {
  const plan = await getActiveVerificationPlan(incidentId, FIRE_VERIFICATION_MODEL_VERSION)
  if (!plan) return null
  return getVerificationPlanDetail(plan.id)
}

export async function getIncidentVerificationNeeds(incidentId: string) {
  const plan = await getActiveVerificationPlan(incidentId, FIRE_VERIFICATION_MODEL_VERSION)
  if (!plan) return { items: [], generated_at: new Date().toISOString() }
  const needs = await listVerificationNeedsForPlan(plan.id)
  const methods = await listMethodCandidatesForPlan(plan.id)
  return {
    items: needs.map((n) => ({
      ...n,
      methods: methods.filter((m) => m.need_id === n.id),
    })),
    plan_id: plan.id,
    plan_status: plan.status,
    generated_at: new Date().toISOString(),
  }
}
