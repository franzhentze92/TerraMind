import {
  isAuthTestMode,
  testFindingSnapshot,
  testIncidentSnapshot,
  testNeedSnapshot,
  testPackageSnapshot,
  testPlanSnapshot,
  testPrioritySnapshot,
  testSubmissionSnapshot,
  testTaskSnapshot,
  type TenantResourceSnapshot,
} from '../../auth/resource-fixtures.js'
import { loadMissionAccessSnapshot } from './mission-access.js'

export async function loadIncidentSnapshot(incidentId: string): Promise<TenantResourceSnapshot | null> {
  if (isAuthTestMode()) return testIncidentSnapshot(incidentId)
  const { getIncidentById } = await import('@/pipeline/stores/incidents.store.js')
  const row = await getIncidentById(incidentId)
  if (!row) return null
  return {
    id: String(row.id),
    organization_id: row.organization_id ? String(row.organization_id) : null,
  }
}

export async function loadVerificationPlanSnapshot(planId: string): Promise<TenantResourceSnapshot | null> {
  if (isAuthTestMode()) return testPlanSnapshot(planId)
  const { getVerificationPlanById } = await import('@/pipeline/stores/verification-plans.store.js')
  const row = await getVerificationPlanById(planId)
  if (!row) return null
  return {
    id: String(row.id),
    organization_id: row.organization_id ? String(row.organization_id) : null,
    incident_id: row.incident_id ? String(row.incident_id) : null,
  }
}

export async function loadEvidenceSubmissionSnapshot(
  submissionId: string,
): Promise<TenantResourceSnapshot | null> {
  if (isAuthTestMode()) return testSubmissionSnapshot(submissionId)
  const { getEvidenceSubmissionById } = await import('@/pipeline/stores/evidence-intake.store.js')
  const row = await getEvidenceSubmissionById(submissionId)
  if (!row) return null
  return {
    id: String(row.id),
    organization_id: row.organization_id ? String(row.organization_id) : null,
    mission_id: row.mission_id ? String(row.mission_id) : null,
  }
}

export async function loadOfflinePackageSnapshot(packageId: string): Promise<TenantResourceSnapshot | null> {
  if (isAuthTestMode()) return testPackageSnapshot(packageId)
  const { getOfflinePackageById } = await import('@/pipeline/stores/offline-mission-packages.store.js')
  const row = await getOfflinePackageById(packageId)
  if (!row) return null
  return {
    id: String(row.package_id ?? row.id),
    organization_id: row.organization_id ? String(row.organization_id) : null,
    mission_id: row.mission_id ? String(row.mission_id) : null,
  }
}

export async function loadTaskSnapshot(taskId: string): Promise<TenantResourceSnapshot | null> {
  if (isAuthTestMode()) return testTaskSnapshot(taskId)
  const { getSupabaseAdmin } = await import('@/pipeline/stores/supabase.client.js')
  const { data } = await getSupabaseAdmin()
    .from('mission_tasks')
    .select('id, mission_id')
    .eq('id', taskId)
    .maybeSingle()
  if (!data) return null
  const mission = await loadMissionAccessSnapshot(String(data.mission_id))
  return {
    id: String(data.id),
    organization_id: mission?.organization_id ?? null,
    mission_id: String(data.mission_id),
  }
}

export async function loadFindingSnapshot(findingId: string): Promise<TenantResourceSnapshot | null> {
  if (isAuthTestMode()) return testFindingSnapshot(findingId)
  // composite_findings is national/global intelligence data without an organization_id column.
  const { getSupabaseAdmin } = await import('@/pipeline/stores/supabase.client.js')
  const { data } = await getSupabaseAdmin()
    .from('composite_findings')
    .select('id')
    .eq('id', findingId)
    .maybeSingle()
  if (!data) return null
  return {
    id: String(data.id),
    organization_id: null,
  }
}

export async function loadPrioritySnapshot(priorityId: string): Promise<TenantResourceSnapshot | null> {
  if (isAuthTestMode()) return testPrioritySnapshot(priorityId)
  const { getPriorityAssessmentById } = await import('@/pipeline/stores/priority-assessments.store.js')
  const row = await getPriorityAssessmentById(priorityId)
  if (!row) return null
  return {
    id: String(row.id),
    organization_id: row.organization_id ? String(row.organization_id) : null,
  }
}

export async function loadVerificationNeedSnapshot(needId: string): Promise<TenantResourceSnapshot | null> {
  if (isAuthTestMode()) return testNeedSnapshot(needId)
  const { getSupabaseAdmin } = await import('@/pipeline/stores/supabase.client.js')
  const { data } = await getSupabaseAdmin()
    .from('verification_needs')
    .select('id, verification_plan_id')
    .eq('id', needId)
    .maybeSingle()
  if (!data) return null
  const plan = data.verification_plan_id
    ? await loadVerificationPlanSnapshot(String(data.verification_plan_id))
    : null
  return {
    id: String(data.id),
    organization_id: plan?.organization_id ?? null,
    verification_plan_id: data.verification_plan_id ? String(data.verification_plan_id) : null,
  }
}
