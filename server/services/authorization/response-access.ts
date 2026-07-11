import type { AuthorizedResourceContext, RequestAuthContext, TerramindPermission } from '@/core/auth/permissions'
import { AuthorizationError, assertPermission } from '@/core/auth/permissions'
import { authorizeWithPermission, buildAuthorizedResourceContext } from './authorization-core.js'
import { loadIncidentSnapshot } from './resource-resolver.js'
import {
  getActionById,
  getActiveAssessmentForIncident,
  getDecisionById,
} from '@/pipeline/stores/response-orchestration.store.js'

async function loadAssessmentSnapshot(assessmentId: string) {
  const { getSupabaseAdmin } = await import('@/pipeline/stores/supabase.client.js')
  const { data } = await getSupabaseAdmin()
    .from('response_assessments')
    .select('id, organization_id, incident_id, status')
    .eq('id', assessmentId)
    .maybeSingle()
  if (!data) return null
  return {
    id: String(data.id),
    organization_id: data.organization_id ? String(data.organization_id) : null,
    incident_id: String(data.incident_id),
    status: String(data.status),
  }
}

function assertDecisionMutable(status: string): void {
  if (status === 'superseded' || status === 'cancelled') {
    throw new AuthorizationError('Decisión no disponible (superseded)', 409)
  }
}

function assertRolesForApproval(auth: RequestAuthContext): void {
  if (auth.isPlatformAdmin) return
  const allowed = auth.roles.some((r) =>
    ['platform_admin', 'organization_admin', 'operations_coordinator'].includes(r),
  )
  if (!allowed) throw new AuthorizationError('Autoridad insuficiente para aprobar', 403)
}

export async function authorizeResponseAssessmentAccess(
  auth: RequestAuthContext,
  incidentId: string,
  permission: TerramindPermission = 'responses.view',
): Promise<AuthorizedResourceContext> {
  const incident = await loadIncidentSnapshot(incidentId)
  if (!incident) throw new AuthorizationError('Incidente no encontrado', 404)
  if (!incident.organization_id) {
    assertPermission(auth, permission)
    return {
      ...auth,
      resourceType: 'response_assessment',
      resourceId: incident.id,
      organizationId: auth.activeOrganizationId,
      authorizedAt: new Date().toISOString(),
    }
  }
  return authorizeWithPermission(auth, permission, incident, 'response_assessment')
}

export async function authorizeResponseDecisionAccess(
  auth: RequestAuthContext,
  decisionId: string,
  permission: TerramindPermission = 'responses.view',
): Promise<AuthorizedResourceContext & { decision_status: string; incident_id: string }> {
  const decision = await getDecisionById(decisionId)
  if (!decision) throw new AuthorizationError('Decisión no encontrada', 404)
  const ctx = authorizeWithPermission(
    auth,
    permission,
    {
      id: String(decision.id),
      organization_id: decision.organization_id ? String(decision.organization_id) : null,
    },
    'decision_record',
  )
  return {
    ...ctx,
    decision_status: String(decision.decision_status),
    incident_id: String(decision.incident_id),
  }
}

export async function authorizeResponseActionAccess(
  auth: RequestAuthContext,
  actionId: string,
  permission: TerramindPermission = 'response_actions.execute',
): Promise<AuthorizedResourceContext> {
  const action = await getActionById(actionId)
  if (!action) throw new AuthorizationError('Acción no encontrada', 404)
  return authorizeWithPermission(
    auth,
    permission,
    {
      id: String(action.id),
      organization_id: action.organization_id ? String(action.organization_id) : null,
    },
    'response_action',
  )
}

export async function authorizeResponseApproval(
  auth: RequestAuthContext,
  decisionId: string,
): Promise<AuthorizedResourceContext> {
  assertPermission(auth, 'responses.approve')
  assertRolesForApproval(auth)
  const ctx = await authorizeResponseDecisionAccess(auth, decisionId, 'responses.approve')
  assertDecisionMutable(ctx.decision_status)
  if (ctx.decision_status === 'approved') {
    throw new AuthorizationError('Decisión ya aprobada', 409)
  }
  return ctx
}

export async function authorizeNotificationDirectiveAccess(
  auth: RequestAuthContext,
  decisionId: string,
): Promise<AuthorizedResourceContext> {
  return authorizeResponseDecisionAccess(auth, decisionId, 'notifications.prepare')
}

export async function authorizeClosureRecommendationAccess(
  auth: RequestAuthContext,
  incidentId: string,
): Promise<AuthorizedResourceContext> {
  const ctx = await authorizeResponseAssessmentAccess(auth, incidentId, 'incident_closure.recommend')
  const assessment = await getActiveAssessmentForIncident(incidentId, ctx.organizationId)
  if (!assessment) throw new AuthorizationError('Assessment no encontrado', 404)
  return ctx
}

export async function authorizeResponseModify(
  auth: RequestAuthContext,
  decisionId: string,
): Promise<AuthorizedResourceContext> {
  const ctx = await authorizeResponseDecisionAccess(auth, decisionId, 'responses.modify')
  assertDecisionMutable(ctx.decision_status)
  return ctx
}

export async function authorizeResponseReject(
  auth: RequestAuthContext,
  decisionId: string,
): Promise<AuthorizedResourceContext> {
  const ctx = await authorizeResponseDecisionAccess(auth, decisionId, 'responses.reject')
  assertDecisionMutable(ctx.decision_status)
  return ctx
}

export async function authorizeResponseAssess(
  auth: RequestAuthContext,
  incidentId: string,
): Promise<AuthorizedResourceContext> {
  return authorizeResponseAssessmentAccess(auth, incidentId, 'responses.assess')
}

export async function authorizeResponseDecide(
  auth: RequestAuthContext,
  incidentId: string,
): Promise<AuthorizedResourceContext> {
  return authorizeResponseAssessmentAccess(auth, incidentId, 'responses.decide')
}

export function authorizeResponseListScope(auth: RequestAuthContext): AuthorizedResourceContext {
  assertPermission(auth, 'responses.view')
  return buildAuthorizedResourceContext(auth, 'response_list', {
    id: auth.activeOrganizationId,
    organization_id: auth.activeOrganizationId,
  })
}
