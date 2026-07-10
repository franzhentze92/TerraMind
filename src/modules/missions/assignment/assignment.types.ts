export const ASSIGNMENT_STATUSES = [
  'proposed',
  'assigned',
  'accepted',
  'declined',
  'active',
  'released',
  'completed',
  'cancelled',
] as const

export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number]

export type AssigneeType = 'user' | 'team' | 'organization' | 'external_actor'

export type MissionPermission =
  | 'missions.assign'
  | 'missions.accept'
  | 'missions.decline'
  | 'missions.reassign'
  | 'missions.start'
  | 'missions.block'
  | 'missions.complete'
  | 'missions.cancel'
  | 'missions.override_compatibility'

export interface OperationalAssignee {
  id: string
  assignee_type: AssigneeType
  display_name: string
  organization_id: string | null
  coverage_zones: string[]
  capabilities: string[]
  allowed_mission_types: string[]
  max_active_missions: number
  is_available: boolean
  is_active: boolean
  permissions: MissionPermission[]
}

export interface MissionWorkflowContext {
  mission_id: string
  mission_type: string
  mission_status: string
  recommended_method_code: string
  expires_at: string
  due_at: string
  location_geometry: Record<string, unknown> | null
  active_assignment: {
    id: string
    status: AssignmentStatus
    assignee_type: AssigneeType
    assignee_id: string
  } | null
}

export interface CompatibilityResult {
  compatible: boolean
  score: number
  reasons: string[]
  limitations: string[]
  missing_capabilities: string[]
}

export interface WorkflowActor {
  actor_type: 'system' | 'user'
  actor_id: string | null
  permissions: MissionPermission[]
}

export interface WorkflowCommand {
  action:
    | 'assign'
    | 'accept'
    | 'decline'
    | 'reassign'
    | 'start'
    | 'block'
    | 'resume'
    | 'complete'
    | 'cancel'
  mission_id: string
  assignee_type?: AssigneeType
  assignee_id?: string
  organization_id?: string | null
  reason?: string
  idempotency_key?: string
  override_compatibility?: boolean
  explicit_inconclusive?: boolean
  actor: WorkflowActor
}

export interface WorkflowResult {
  ok: boolean
  action: string
  mission_status: string
  assignment_status: AssignmentStatus | null
  assignment_id: string | null
  reasons: string[]
  warnings: string[]
  idempotent_replay: boolean
}
