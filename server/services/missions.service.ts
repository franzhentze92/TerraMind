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
  listAssignmentHistory,
  listAssignmentsForMission,
} from '@/pipeline/stores/mission-assignments.store'

export async function listMissionsDto(filters: {
  status?: string
  incident_id?: string
  verification_plan_id?: string
  limit?: number
}) {
  const rows = await listMissions(filters)
  const items = []
  for (const m of rows) {
    const tasks = await listMissionTasks(m.id)
    const evidence = await listMissionEvidenceRequirements(m.id)
    const incident = await getIncidentById(m.incident_id)
    items.push({
      id: m.id,
      mission_type: m.mission_type,
      title: m.title,
      status: m.status,
      incident_id: m.incident_id,
      incident_status: incident?.status ?? null,
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
  return { items, generated_at: new Date().toISOString() }
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
  return {
    ...mission,
    incident_status: incident?.status ?? null,
    tasks,
    evidence_requirements: evidence,
    transitions,
    active_assignment: activeAssignment,
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

export async function getIncidentMissions(incidentId: string) {
  return listMissionsDto({ incident_id: incidentId, limit: 50 })
}

export async function getVerificationPlanMissions(planId: string) {
  return listMissionsDto({ verification_plan_id: planId, limit: 50 })
}
