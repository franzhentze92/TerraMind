import type {
  DecisionStatus,
  ResponseOrchestrationOutput,
} from '@/modules/response-orchestration/response-orchestration.types'

export interface DecisionDraftInput {
  assessment_id: string
  incident_id: string
  organization_id: string
  assessment: ResponseOrchestrationOutput
  decided_by?: string | null
}

export interface DecisionRecordDraft {
  decision_type: 'system_recommendation' | 'human_decision'
  decision: string
  decision_status: DecisionStatus
  original_recommendation: ResponseOrchestrationOutput
  rationale: string
  limitations: string[]
}

export function createDecisionDraftFromAssessment(input: DecisionDraftInput): DecisionRecordDraft {
  const assessment = input.assessment
  return {
    decision_type: 'system_recommendation',
    decision: assessment.recommendedResponseLevel,
    decision_status: 'recommended',
    original_recommendation: assessment,
    rationale: `Motor recomienda ${assessment.recommendedResponseLevel} (${assessment.urgency})`,
    limitations: [
      'Recomendación del sistema — no equivale a decisión aprobada',
      'No ejecuta acciones de alto riesgo automáticamente',
    ],
  }
}

export function applyHumanDecisionModification(input: {
  draft: DecisionRecordDraft
  modified_decision: string
  rationale: string
  actor_id: string
}): DecisionRecordDraft {
  return {
    ...input.draft,
    decision_type: 'human_decision',
    decision: input.modified_decision,
    decision_status: 'modified',
    rationale: input.rationale,
    limitations: [
      ...input.draft.limitations,
      `Modificado por actor ${input.actor_id.slice(0, 8)}…`,
    ],
  }
}

export function approveDecision(draft: DecisionRecordDraft): DecisionRecordDraft {
  if (draft.decision_status === 'rejected' || draft.decision_status === 'superseded') {
    throw new Error('cannot_approve_terminal_decision')
  }
  return { ...draft, decision_status: 'approved' }
}

export function rejectDecision(draft: DecisionRecordDraft, rationale: string): DecisionRecordDraft {
  return {
    ...draft,
    decision_status: 'rejected',
    rationale,
    limitations: [...draft.limitations, 'Decisión rechazada — assessment conservado'],
  }
}
