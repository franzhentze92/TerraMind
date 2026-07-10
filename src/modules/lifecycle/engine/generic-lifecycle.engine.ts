import {
  FIRE_LIFECYCLE_ALLOWED_TRANSITIONS,
  FIRE_LIFECYCLE_MODEL_VERSION,
} from '@/modules/lifecycle/config/fire-lifecycle.config'
import {
  buildFireLifecycleContextSignature,
  evaluateFireLifecycleState,
} from '@/modules/lifecycle/rules/fire-lifecycle-rules'
import {
  isTransitionAllowed,
  type FireLifecycleState,
  type LifecycleEvaluationResult,
  type LifecycleEvaluationSnapshot,
} from '@/modules/lifecycle/lifecycle.types'

export function evaluateLifecycleForSnapshot(input: {
  snapshot: LifecycleEvaluationSnapshot
  evaluatedAt: string
  lifecycleModelVersion?: string
}): LifecycleEvaluationResult {
  const started = Date.now()
  const modelVersion = input.lifecycleModelVersion ?? FIRE_LIFECYCLE_MODEL_VERSION
  const previous = input.snapshot.lifecycle_state
  const ruleResult = evaluateFireLifecycleState(input.snapshot, input.evaluatedAt)
  let proposed = ruleResult.proposed_state

  if (
    previous &&
    proposed !== previous &&
    !isTransitionAllowed(FIRE_LIFECYCLE_ALLOWED_TRANSITIONS, previous, proposed)
  ) {
    proposed = previous
    ruleResult.transition_rule = 'FIRE_LIFECYCLE_TRANSITION_REJECTED_001'
    ruleResult.transition_reason = `Transición no permitida: ${previous} → ${ruleResult.proposed_state}`
  }

  const transitioned = previous !== proposed
  const contextSignature = buildFireLifecycleContextSignature(input.snapshot)

  return {
    entity_type: input.snapshot.entity_type,
    entity_id: input.snapshot.entity_id,
    previous_state: previous,
    new_state: proposed,
    transitioned,
    transition_rule: ruleResult.transition_rule,
    transition_reason: ruleResult.transition_reason,
    evidence_snapshot: ruleResult.evidence_snapshot,
    source_detection_ids: ruleResult.source_detection_ids,
    lifecycle_model_version: modelVersion,
    context_signature: contextSignature,
    correlation_kind: ruleResult.correlation_kind,
    evaluated_at: input.evaluatedAt,
    warnings: [],
    duration_ms: Date.now() - started,
  }
}

export const genericLifecycleEngine = {
  evaluate: evaluateLifecycleForSnapshot,
  modelVersion: FIRE_LIFECYCLE_MODEL_VERSION,
  allowedTransitions: FIRE_LIFECYCLE_ALLOWED_TRANSITIONS,
  isValidTransition: (from: FireLifecycleState | null, to: FireLifecycleState) =>
    isTransitionAllowed(FIRE_LIFECYCLE_ALLOWED_TRANSITIONS, from, to),
}
