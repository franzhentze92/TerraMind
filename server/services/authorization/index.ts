import type { AuthorizedResourceContext, RequestAuthContext, TerramindPermission } from '@/core/auth/permissions'
import { AuthorizationError, assertPermission } from '@/core/auth/permissions'
import { authorizeWithPermission, buildAuthorizedResourceContext } from './authorization-core.js'
import { authorizeAssignmentAction, authorizeMissionAccess } from './mission-access.js'
import {
  loadEvidenceSubmissionSnapshot,
  loadFindingSnapshot,
  loadIncidentSnapshot,
  loadOfflinePackageSnapshot,
  loadPrioritySnapshot,
  loadTaskSnapshot,
  loadVerificationNeedSnapshot,
  loadVerificationPlanSnapshot,
} from './resource-resolver.js'
import { permissionForWorkflowAction } from './workflow-access.js'
import { assertRealSyncPilotAllowed } from '../../auth/real-sync-pilot-policy.js'

export { authorizeMissionAccess, authorizeAssignmentAction } from './mission-access.js'
export { permissionForWorkflowAction } from './workflow-access.js'
export {
  authorizeResponseAssessmentAccess,
  authorizeResponseDecisionAccess,
  authorizeResponseActionAccess,
  authorizeResponseApproval,
  authorizeNotificationDirectiveAccess,
  authorizeClosureRecommendationAccess,
  authorizeResponseModify,
  authorizeResponseReject,
  authorizeResponseAssess,
  authorizeResponseDecide,
  authorizeResponseListScope,
} from './response-access.js'

export async function authorizeMissionWorkflowAction(
  auth: RequestAuthContext,
  missionId: string,
  action: string,
): Promise<AuthorizedResourceContext> {
  const permission = permissionForWorkflowAction(action)
  assertPermission(auth, permission)
  return authorizeMissionAccess(auth, missionId, {
    requireAssignee: ['accept', 'decline', 'start', 'complete'].includes(action),
  })
}

export async function authorizeFieldSyncAccess(
  auth: RequestAuthContext,
  input: {
    mission_id: string
    package_id?: string | null
    bundle_id?: string | null
  },
): Promise<AuthorizedResourceContext> {
  const missionCtx = await authorizeMissionAccess(auth, input.mission_id, { requireAssignee: true })
  assertPermission(auth, 'field_sync.execute')
  if (input.package_id) {
    const pkg = await loadOfflinePackageSnapshot(input.package_id)
    if (!pkg) throw new AuthorizationError('Paquete no encontrado', 404)
    if (pkg.mission_id && pkg.mission_id !== input.mission_id) {
      throw new AuthorizationError('Paquete no pertenece a la misión', 403)
    }
    if (
      pkg.organization_id &&
      pkg.organization_id !== auth.activeOrganizationId &&
      !auth.isPlatformAdmin
    ) {
      throw new AuthorizationError('Acceso cross-tenant denegado', 403)
    }
    authorizeWithPermission(auth, 'offline_packages.download', pkg, 'offline_mission_package')
  }
  await assertRealSyncPilotAllowed(auth, input.mission_id)
  return missionCtx
}

export async function authorizeEvidenceSubmissionRead(
  auth: RequestAuthContext,
  submissionId: string,
): Promise<AuthorizedResourceContext> {
  const submission = await loadEvidenceSubmissionSnapshot(submissionId)
  if (!submission?.mission_id) throw new AuthorizationError('Submission no encontrada', 404)
  await authorizeMissionAccess(auth, submission.mission_id)
  return authorizeWithPermission(auth, 'evidence.view', submission, 'evidence_submission')
}

export async function authorizeEvidenceSubmissionWrite(
  auth: RequestAuthContext,
  submissionId: string,
  writePermission: TerramindPermission = 'evidence.submit',
): Promise<AuthorizedResourceContext> {
  const submission = await loadEvidenceSubmissionSnapshot(submissionId)
  if (!submission?.mission_id) throw new AuthorizationError('Submission no encontrada', 404)
  await authorizeMissionAccess(auth, submission.mission_id, { requireAssignee: true })
  return authorizeWithPermission(auth, writePermission, submission, 'evidence_submission')
}

export async function authorizeEvidenceMissionWrite(
  auth: RequestAuthContext,
  missionId: string,
): Promise<AuthorizedResourceContext> {
  return authorizeMissionAccess(auth, missionId, { requireAssignee: true })
}

export async function authorizeEvidenceValidation(
  auth: RequestAuthContext,
  submissionId: string,
): Promise<AuthorizedResourceContext> {
  return authorizeEvidenceSubmissionWrite(auth, submissionId, 'evidence.validate')
}

export async function authorizeOfflinePackageAccess(
  auth: RequestAuthContext,
  packageId: string,
  action: 'download' | 'revoke' | 'generate' | 'read',
): Promise<AuthorizedResourceContext> {
  const pkg = await loadOfflinePackageSnapshot(packageId)
  if (!pkg?.mission_id) throw new AuthorizationError('Paquete no encontrado', 404)
  const permission =
    action === 'generate'
      ? 'offline_packages.generate'
      : action === 'revoke'
        ? 'offline_packages.revoke'
        : action === 'download'
          ? 'offline_packages.download'
          : 'offline_packages.download'
  await authorizeMissionAccess(auth, pkg.mission_id, { requireAssignee: action === 'download' })
  return authorizeWithPermission(auth, permission, pkg, 'offline_mission_package')
}

export async function authorizeOfflinePackageMissionAction(
  auth: RequestAuthContext,
  missionId: string,
  action: 'generate' | 'list',
): Promise<AuthorizedResourceContext> {
  const permission = action === 'generate' ? 'offline_packages.generate' : 'offline_packages.download'
  return authorizeMissionAccess(auth, missionId, { requireAssignee: action === 'generate' ? false : true })
    .then((ctx) => {
      assertPermission(auth, permission)
      return ctx
    })
}

export async function authorizeIncidentAccess(
  auth: RequestAuthContext,
  incidentId: string,
): Promise<AuthorizedResourceContext> {
  const incident = await loadIncidentSnapshot(incidentId)
  if (!incident) throw new AuthorizationError('Incidente no encontrado', 404)
  return authorizeWithPermission(auth, 'incidents.view', incident, 'incident')
}

export async function authorizeVerificationPlanAccess(
  auth: RequestAuthContext,
  planId: string,
): Promise<AuthorizedResourceContext> {
  const plan = await loadVerificationPlanSnapshot(planId)
  if (!plan) throw new AuthorizationError('Plan no encontrado', 404)
  return authorizeWithPermission(auth, 'verification_plans.view', plan, 'verification_plan')
}

export async function authorizeVerificationNeedAccess(
  auth: RequestAuthContext,
  needId: string,
): Promise<AuthorizedResourceContext> {
  const need = await loadVerificationNeedSnapshot(needId)
  if (!need) throw new AuthorizationError('Need no encontrado', 404)
  return authorizeWithPermission(auth, 'verification_plans.view', need, 'verification_need')
}

export async function authorizeFindingAccess(
  auth: RequestAuthContext,
  findingId: string,
): Promise<AuthorizedResourceContext> {
  const finding = await loadFindingSnapshot(findingId)
  if (!finding) throw new AuthorizationError('Hallazgo no encontrado', 404)
  return authorizeWithPermission(auth, 'findings.view', finding, 'finding')
}

export async function authorizePriorityAccess(
  auth: RequestAuthContext,
  priorityId: string,
): Promise<AuthorizedResourceContext> {
  const priority = await loadPrioritySnapshot(priorityId)
  if (!priority) throw new AuthorizationError('Prioridad no encontrada', 404)
  return authorizeWithPermission(auth, 'priorities.view', priority, 'priority')
}

export async function authorizeTaskEvidenceRead(
  auth: RequestAuthContext,
  taskId: string,
): Promise<AuthorizedResourceContext> {
  const task = await loadTaskSnapshot(taskId)
  if (!task?.mission_id) throw new AuthorizationError('Tarea no encontrada', 404)
  await authorizeMissionAccess(auth, task.mission_id)
  return authorizeWithPermission(auth, 'evidence.view', task, 'mission_task')
}

export async function authorizeSignedUploadUrl(
  auth: RequestAuthContext,
  submissionId: string,
): Promise<AuthorizedResourceContext> {
  return authorizeEvidenceSubmissionWrite(auth, submissionId, 'evidence.submit')
}

export async function authorizeAssigneeListAccess(
  auth: RequestAuthContext,
  assigneeType: string,
  assigneeId: string,
): Promise<AuthorizedResourceContext> {
  assertPermission(auth, 'missions.view')
  if (
    assigneeType === 'user' &&
    assigneeId !== auth.userId &&
    !auth.isPlatformAdmin &&
    !auth.roles.includes('field_supervisor') &&
    !auth.roles.includes('operations_coordinator')
  ) {
    throw new AuthorizationError('No puede listar misiones de otro usuario', 403)
  }
  return buildAuthorizedResourceContext(auth, 'operational_assignee', {
    id: assigneeId,
    organization_id: auth.activeOrganizationId,
  })
}

// Backward-compatible aliases
export async function authorizeEvidenceAccess(
  auth: RequestAuthContext,
  submission: { id: string; organization_id: string | null; mission_id: string },
): Promise<AuthorizedResourceContext> {
  await authorizeMissionAccess(auth, submission.mission_id, { requireAssignee: true })
  return authorizeWithPermission(auth, 'evidence.submit', submission, 'evidence_submission')
}
