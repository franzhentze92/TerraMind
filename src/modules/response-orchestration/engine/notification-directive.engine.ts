import type { ResponseOrchestrationOutput } from '@/modules/response-orchestration/response-orchestration.types'

export interface NotificationDirectiveDraft {
  audience_type: 'internal_operations' | 'coordinator' | 'supervisor' | 'analyst'
  channel_type: 'internal_brief' | 'internal_alert' | 'coordination_request'
  urgency: string
  message_template_id: string
  approval_required: boolean
  status: 'draft'
  draft_payload: Record<string, unknown>
}

export function buildNotificationDirectiveDrafts(
  assessment: ResponseOrchestrationOutput,
): NotificationDirectiveDraft[] {
  if (assessment.recommendedResponseLevel === 'no_response_required') return []
  if (assessment.recommendedResponseLevel === 'continue_monitoring') return []

  const drafts: NotificationDirectiveDraft[] = []

  if (
    assessment.recommendedActions.some((a) => a.action_type === 'prepare_internal_brief') ||
    assessment.recommendedResponseLevel === 'prepare_internal_response'
  ) {
    drafts.push({
      audience_type: 'internal_operations',
      channel_type: 'internal_brief',
      urgency: assessment.urgency,
      message_template_id: 'fire_internal_brief_v1',
      approval_required: true,
      status: 'draft',
      draft_payload: {
        response_level: assessment.recommendedResponseLevel,
        epistemic: 'recommended',
        note: 'Directiva de comunicación — no equivale a mensaje enviado',
      },
    })
  }

  if (assessment.recommendedResponseLevel === 'escalate_for_authorized_review') {
    drafts.push({
      audience_type: 'supervisor',
      channel_type: 'coordination_request',
      urgency: assessment.urgency,
      message_template_id: 'fire_authorized_review_v1',
      approval_required: true,
      status: 'draft',
      draft_payload: {
        rationale_codes: assessment.rationaleCodes,
        epistemic: 'recommended',
      },
    })
  }

  return drafts
}
