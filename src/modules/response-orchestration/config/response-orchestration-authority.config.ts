import type { ResponseActionType } from '@/modules/response-orchestration/response-orchestration.types'
import type { TerramindRole } from '@/core/auth/permissions'

export interface AuthorityMatrixEntry {
  action_type: ResponseActionType
  permission: string
  allowed_roles: TerramindRole[]
  approval_required: boolean
  dual_approval_required: boolean
  auto_execute_allowed: boolean
  scope: 'organization' | 'incident'
}

export const RESPONSE_ORCHESTRATION_PERMISSIONS = [
  'responses.view',
  'responses.assess',
  'responses.decide',
  'responses.approve',
  'responses.modify',
  'responses.reject',
  'response_actions.create',
  'response_actions.execute',
  'response_actions.complete',
  'notifications.prepare',
  'notifications.approve',
  'incident_closure.recommend',
] as const

export const AUTHORITY_MATRIX: AuthorityMatrixEntry[] = [
  {
    action_type: 'continue_monitoring',
    permission: 'responses.view',
    allowed_roles: ['platform_admin', 'operations_coordinator', 'field_supervisor', 'analyst'],
    approval_required: false,
    dual_approval_required: false,
    auto_execute_allowed: true,
    scope: 'incident',
  },
  {
    action_type: 'schedule_reassessment',
    permission: 'responses.assess',
    allowed_roles: ['platform_admin', 'operations_coordinator', 'analyst'],
    approval_required: false,
    dual_approval_required: false,
    auto_execute_allowed: true,
    scope: 'incident',
  },
  {
    action_type: 'prepare_internal_brief',
    permission: 'responses.view',
    allowed_roles: ['platform_admin', 'operations_coordinator', 'analyst'],
    approval_required: false,
    dual_approval_required: false,
    auto_execute_allowed: true,
    scope: 'incident',
  },
  {
    action_type: 'request_additional_mission',
    permission: 'response_actions.create',
    allowed_roles: ['platform_admin', 'operations_coordinator'],
    approval_required: true,
    dual_approval_required: false,
    auto_execute_allowed: false,
    scope: 'incident',
  },
  {
    action_type: 'request_specialist_review',
    permission: 'responses.approve',
    allowed_roles: ['platform_admin', 'operations_coordinator', 'field_supervisor'],
    approval_required: true,
    dual_approval_required: false,
    auto_execute_allowed: false,
    scope: 'incident',
  },
  {
    action_type: 'coordinate_external_review',
    permission: 'responses.approve',
    allowed_roles: ['platform_admin', 'operations_coordinator', 'field_supervisor'],
    approval_required: true,
    dual_approval_required: true,
    auto_execute_allowed: false,
    scope: 'organization',
  },
  {
    action_type: 'recommend_incident_closure',
    permission: 'incident_closure.recommend',
    allowed_roles: ['platform_admin', 'operations_coordinator', 'analyst'],
    approval_required: true,
    dual_approval_required: false,
    auto_execute_allowed: false,
    scope: 'incident',
  },
  {
    action_type: 'recommend_event_reclassification',
    permission: 'responses.approve',
    allowed_roles: ['platform_admin', 'operations_coordinator', 'analyst'],
    approval_required: true,
    dual_approval_required: false,
    auto_execute_allowed: false,
    scope: 'incident',
  },
  {
    action_type: 'recommend_observation_invalidation',
    permission: 'responses.approve',
    allowed_roles: ['platform_admin', 'operations_coordinator'],
    approval_required: true,
    dual_approval_required: true,
    auto_execute_allowed: false,
    scope: 'incident',
  },
  {
    action_type: 'notify_internal_operations',
    permission: 'notifications.prepare',
    allowed_roles: ['platform_admin', 'operations_coordinator'],
    approval_required: true,
    dual_approval_required: false,
    auto_execute_allowed: false,
    scope: 'organization',
  },
]

export function getAuthorityForAction(actionType: ResponseActionType): AuthorityMatrixEntry | undefined {
  return AUTHORITY_MATRIX.find((e) => e.action_type === actionType)
}
