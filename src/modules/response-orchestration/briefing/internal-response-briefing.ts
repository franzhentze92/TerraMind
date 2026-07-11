import type {
  InternalResponseBriefing,
  ResponseOrchestrationInput,
  ResponseOrchestrationOutput,
} from '@/modules/response-orchestration/response-orchestration.types'

export function buildInternalResponseBriefing(input: {
  orchestrationInput: ResponseOrchestrationInput
  assessment: ResponseOrchestrationOutput
  decision?: Record<string, unknown>
  actions?: Array<Record<string, unknown>>
}): InternalResponseBriefing {
  const { orchestrationInput: snap, assessment } = input
  return {
    incidentSummary: {
      incident_id: snap.incident.incident_id,
      status: snap.incident.status,
      last_observed_at: snap.incident.last_observed_at,
      epistemic: 'verified',
    },
    observationSummary: {
      lifecycle_state: snap.lifecycle.lifecycle_state,
      last_detected_at: snap.lifecycle.last_detected_at,
      epistemic: 'observed',
    },
    findingSummary: {
      count: snap.findings.length,
      codes: snap.findings.map((f) => f.finding_code),
      epistemic: 'inferred',
    },
    prioritySummary: {
      attention_score: snap.priority.attention_score,
      verification_score: snap.priority.verification_score,
      action_score: snap.priority.action_score,
      epistemic: 'inferred',
    },
    verificationSummary: {
      plan_status: snap.verificationResolution.plan_status,
      satisfied_count: snap.verificationResolution.satisfied_count,
      inconclusive_count: snap.verificationResolution.inconclusive_count,
      conflicting_count: snap.verificationResolution.conflicting_count,
      epistemic: 'verified',
    },
    evidenceSummary: {
      ...snap.evidenceSummary,
      epistemic: 'verified',
    },
    residualUncertainty: snap.verificationResolution.remaining_uncertainties,
    recommendedResponse: {
      level: assessment.recommendedResponseLevel,
      urgency: assessment.urgency,
      rationale_codes: assessment.rationaleCodes,
      epistemic: 'recommended',
    },
    decision: input.decision,
    actions: input.actions ?? assessment.recommendedActions.map((a) => ({
      action_type: a.action_type,
      epistemic: 'recommended',
    })),
    nextMilestones: assessment.reassessmentAt
      ? [`Reevaluación programada: ${assessment.reassessmentAt}`]
      : [],
  }
}
