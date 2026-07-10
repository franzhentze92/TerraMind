import type { AuthorizedResourceContext, RequestAuthContext } from '@/core/auth/permissions'
import { authorizeWithPermission } from './authorization-core.js'
import { authorizeMissionAccess } from './mission-access.js'

export async function authorizeFieldSyncAccess(
  auth: RequestAuthContext,
  input: {
    mission_id: string
    package_id?: string | null
    bundle_id?: string | null
  },
): Promise<AuthorizedResourceContext> {
  const missionCtx = await authorizeMissionAccess(auth, input.mission_id, { requireAssignee: true })
  authorizeWithPermission(auth, 'field_sync.execute', {
    id: input.bundle_id ?? input.package_id ?? input.mission_id,
    organization_id: missionCtx.organizationId,
  }, 'field_sync')
  return missionCtx
}

export async function authorizeEvidenceAccess(
  auth: RequestAuthContext,
  submission: { id: string; organization_id: string | null; mission_id: string },
): Promise<AuthorizedResourceContext> {
  await authorizeMissionAccess(auth, submission.mission_id, { requireAssignee: true })
  return authorizeWithPermission(auth, 'evidence.submit', submission, 'evidence_submission')
}

export async function authorizeOfflinePackageAccess(
  auth: RequestAuthContext,
  pkg: { id: string; organization_id: string | null; mission_id: string },
  action: 'download' | 'revoke' | 'generate',
): Promise<AuthorizedResourceContext> {
  await authorizeMissionAccess(auth, pkg.mission_id, { requireAssignee: action === 'download' })
  const permission =
    action === 'generate'
      ? 'offline_packages.generate'
      : action === 'revoke'
        ? 'offline_packages.revoke'
        : 'offline_packages.download'
  return authorizeWithPermission(auth, permission, pkg, 'offline_mission_package')
}

export async function authorizeIncidentAccess(
  auth: RequestAuthContext,
  incident: { id: string; organization_id: string | null },
): Promise<AuthorizedResourceContext> {
  return authorizeWithPermission(auth, 'incidents.view', incident, 'incident')
}

export async function authorizeVerificationPlanAccess(
  auth: RequestAuthContext,
  plan: { id: string; organization_id: string | null },
): Promise<AuthorizedResourceContext> {
  return authorizeWithPermission(auth, 'verification_plans.view', plan, 'verification_plan')
}
