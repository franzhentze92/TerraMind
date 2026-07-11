import type {
  AssessmentStatus,
  ReevaluationCompletionSnapshot,
  ResponseOrchestrationInput,
} from '@/modules/response-orchestration/response-orchestration.types'
import { REEVALUATION_EFFECT_TYPES } from '@/modules/response-orchestration/config/fire-response-orchestration.config'

export interface ReevaluationGateResult {
  status: AssessmentStatus
  reasons: string[]
}

function effectRequiresCompletion(effect: string): keyof ReevaluationCompletionSnapshot | null {
  switch (effect) {
    case 'finding_reevaluation_requested':
      return 'findings_complete'
    case 'priority_reevaluation_requested':
      return 'priority_complete'
    case 'lifecycle_reevaluation_requested':
      return 'lifecycle_complete'
    case 'incident_reevaluation_requested':
      return 'incident_correlation_complete'
    case 'verification_replanning_requested':
      return 'verification_plan_complete'
    default:
      return null
  }
}

export function evaluateReevaluationGate(input: ResponseOrchestrationInput): ReevaluationGateResult {
  const state = input.reevaluationState
  const requested = input.verificationResolution.downstream_effects.filter((e) =>
    REEVALUATION_EFFECT_TYPES.includes(e as (typeof REEVALUATION_EFFECT_TYPES)[number]),
  )

  if (state.pending_effect_types.length > 0) {
    return {
      status: 'waiting_for_reevaluation',
      reasons: [`Pending effects: ${state.pending_effect_types.join(', ')}`],
    }
  }

  for (const effect of requested) {
    const key = effectRequiresCompletion(effect)
    if (key && !state[key]) {
      return {
        status: 'waiting_for_reevaluation',
        reasons: [`Incomplete downstream: ${effect}`],
      }
    }
  }

  const resolutionSig = input.verificationResolution.version_signature
  if (
    resolutionSig &&
    state.snapshot_versions.resolution &&
    resolutionSig !== state.snapshot_versions.resolution
  ) {
    return {
      status: 'blocked_inconsistent_snapshot',
      reasons: ['Resolution snapshot version mismatch'],
    }
  }

  if (
    state.snapshot_versions.incident &&
    String(input.incident.incident_version) !== state.snapshot_versions.incident
  ) {
    return {
      status: 'blocked_inconsistent_snapshot',
      reasons: ['Incident version mismatch in reevaluation snapshot'],
    }
  }

  return { status: 'ready_for_assessment', reasons: [] }
}
