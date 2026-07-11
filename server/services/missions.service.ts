import type { RequestAuthContext } from '@/core/auth/permissions'
import {
  getMissionById,
  listMissionEvidenceRequirements,
  listMissions,
  listMissionTasks,
  listMissionTransitions,
} from '@/pipeline/stores/missions.store'
import { getIncidentById } from '@/pipeline/stores/incidents.store'
import {
  getActiveAssignmentForMission,
  getOperationalAssignee,
  listAssignmentHistory,
  listAssignmentsForMission,
} from '@/pipeline/stores/mission-assignments.store'
import { filterRowsByActiveOrganization } from '../auth/tenant-list-scope.js'
import { isInternalDemoMissionTitle, isInternalDemoIncidentId } from '@/modules/executive-demo/demo-config'
import { buildIncidentDisplayName } from '@/modules/incidents/utils/incident-display-name'

/**
 * Classify a mission for operational-vs-demo separation.
 *
 * Robust against several demo signals so a demo/pilot mission can never be
 * mistaken for operational work: the title marker, the demo incident, the
 * internal pilot mission-profile version, or the source snapshot flag.
 */
export function classifyMission(mission: {
  title?: string | null
  incident_id: string
  mission_profile_version?: string | null
  source_snapshot?: Record<string, unknown> | null
}): 'operational' | 'demo' {
  if (isInternalDemoMissionTitle(mission.title ?? '')) return 'demo'
  if (isInternalDemoIncidentId(mission.incident_id)) return 'demo'
  const profile = (mission.mission_profile_version ?? '').toLowerCase()
  if (profile.includes('pilot')) return 'demo'
  if (mission.source_snapshot && mission.source_snapshot.internal_pilot === true) return 'demo'
  return 'operational'
}

export async function listMissionsDto(
  filters: {
  status?: string
  incident_id?: string
  verification_plan_id?: string
  limit?: number
  include_demo?: boolean
  },
  auth?: RequestAuthContext,
) {
  const rows = await listMissions(filters)
  const scoped = (auth
    ? filterRowsByActiveOrganization(auth, rows as Array<{ organization_id?: string | null }>)
    : rows) as typeof rows
  const includeDemo = filters.include_demo === true
  const items: Array<Record<string, unknown>> = []
  let demo_excluded = 0
  for (const m of scoped) {
    const classification = classifyMission(m)
    if (classification === 'demo' && !includeDemo) {
      demo_excluded += 1
      continue
    }
    const tasks = await listMissionTasks(m.id)
    const evidence = await listMissionEvidenceRequirements(m.id)
    const incident = await getIncidentById(m.incident_id)
    items.push({
      id: m.id,
      mission_type: m.mission_type,
      title: m.title,
      status: m.status,
      classification,
      incident_id: m.incident_id,
      incident_status: incident?.status ?? null,
      incident_display_name: incident
        ? buildIncidentDisplayName({
            incident_type: String(incident.incident_type),
            status: String(incident.status),
            event_count: Number(incident.event_count),
            lifecycle_state: incident.lifecycle_state ?? undefined,
          })
        : null,
      verification_plan_id: m.verification_plan_id,
      priority: m.priority,
      recommended_method_code: m.recommended_method_code,
      due_at: m.due_at,
      expires_at: m.expires_at,
      task_count: tasks.length,
      required_evidence_count: evidence.filter((e) => e.required).length,
      blocking_conditions: m.blocking_conditions,
      created_at: m.created_at,
    })
  }
  return { items, demo_excluded, generated_at: new Date().toISOString() }
}

export async function getMissionDetail(id: string) {
  const mission = await getMissionById(id)
  if (!mission) return null
  const tasks = await listMissionTasks(id)
  const evidence = await listMissionEvidenceRequirements(id)
  const transitions = await listMissionTransitions(id)
  const incident = await getIncidentById(mission.incident_id)
  const activeAssignment = await getActiveAssignmentForMission(id)
  const assignments = await listAssignmentsForMission(id)
  const assignmentHistory = await listAssignmentHistory(id)
  const classification = classifyMission(mission)

  // Resolve a human display name for the active assignee (operational only).
  // Demo missions never expose a real responsible; the UI shows a generic label.
  let activeAssignmentDto: Record<string, unknown> | null =
    activeAssignment as unknown as Record<string, unknown> | null
  if (activeAssignment && classification === 'operational') {
    const assignee = await getOperationalAssignee(activeAssignment.assignee_id).catch(() => null)
    activeAssignmentDto = {
      ...activeAssignment,
      assignee_display_name: assignee?.display_name ?? null,
    }
  }

  return {
    ...mission,
    classification,
    incident_status: incident?.status ?? null,
    incident_display_name: incident
      ? buildIncidentDisplayName({
          incident_type: String(incident.incident_type),
          status: String(incident.status),
          event_count: Number(incident.event_count),
          lifecycle_state: incident.lifecycle_state ?? undefined,
        })
      : null,
    tasks,
    evidence_requirements: evidence,
    transitions,
    active_assignment: activeAssignmentDto,
    assignments,
    assignment_history: assignmentHistory,
    generated_at: new Date().toISOString(),
  }
}

export async function getMissionTasksDto(id: string) {
  const mission = await getMissionById(id)
  if (!mission) return null
  const tasks = await listMissionTasks(id)
  return { items: tasks, generated_at: new Date().toISOString() }
}

export async function getMissionEvidenceDto(id: string) {
  const mission = await getMissionById(id)
  if (!mission) return null
  const evidence = await listMissionEvidenceRequirements(id)
  return { items: evidence, generated_at: new Date().toISOString() }
}

export async function getIncidentMissions(incidentId: string, auth?: RequestAuthContext) {
  return listMissionsDto({ incident_id: incidentId, limit: 50, include_demo: true }, auth)
}

export async function getVerificationPlanMissions(planId: string, auth?: RequestAuthContext) {
  return listMissionsDto({ verification_plan_id: planId, limit: 50, include_demo: true }, auth)
}
