import { LOW_RISK_AUTO_ACTIONS } from '@/modules/response-orchestration/config/fire-response-orchestration.config'
import { getAuthorityForAction } from '@/modules/response-orchestration/config/response-orchestration-authority.config'
import type {
  ActionStatus,
  RecommendedAction,
  ResponseActionType,
} from '@/modules/response-orchestration/response-orchestration.types'

export interface ResponseActionDraft {
  action_type: ResponseActionType
  status: ActionStatus
  execution_mode: 'manual' | 'auto_draft' | 'auto_execute'
  requires_approval: boolean
  owner_type: 'system' | 'user'
  owner_id: string | null
  priority: number
  rationale_code: string
}

export function materializeLowRiskActionDrafts(input: {
  recommendedActions: RecommendedAction[]
  prohibitedActionTypes: ResponseActionType[]
  decision_status: string
}): ResponseActionDraft[] {
  if (input.decision_status === 'rejected') return []

  return input.recommendedActions
    .filter((a) => !input.prohibitedActionTypes.includes(a.action_type))
    .filter((a) => LOW_RISK_AUTO_ACTIONS.includes(a.action_type) || a.execution_mode === 'auto_draft')
    .map((a) => {
      const authority = getAuthorityForAction(a.action_type)
      const canAuto = authority?.auto_execute_allowed && LOW_RISK_AUTO_ACTIONS.includes(a.action_type)
      return {
        action_type: a.action_type,
        status: canAuto ? 'executing' : 'draft',
        execution_mode: canAuto ? 'auto_execute' : 'auto_draft',
        requires_approval: !canAuto,
        owner_type: 'system',
        owner_id: null,
        priority: a.priority,
        rationale_code: a.rationale_code,
      }
    })
}

export function assertActionAutoExecuteAllowed(actionType: ResponseActionType): void {
  const authority = getAuthorityForAction(actionType)
  if (!authority?.auto_execute_allowed || !LOW_RISK_AUTO_ACTIONS.includes(actionType)) {
    throw new Error(`auto_execute_not_allowed:${actionType}`)
  }
}
