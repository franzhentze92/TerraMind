import { assertSafeVerificationCopy } from '@/modules/verification/verification-copy-guard'
import {
  FIRE_VERIFICATION_MODEL_VERSION,
  FIRE_VERIFICATION_THRESHOLDS,
  PLAN_PRIORITY_WEIGHTS,
} from '@/modules/verification/config/fire-verification.config'
import {
  deriveVerificationNeeds,
  isVerificationNotRequired,
} from '@/modules/verification/engine/verification-need-derivation'
import {
  dedupeMethodsAcrossNeeds,
  rankMethodsForNeed,
} from '@/modules/verification/engine/verification-method-ranking'
import {
  hashVerificationSignature,
  sortNeedsDeterministic,
  type IncidentVerificationSnapshot,
  type VerificationPlanResult,
} from '@/modules/verification/verification.types'

function hoursSince(iso: string, evaluatedAt: string): number {
  return (Date.parse(evaluatedAt) - Date.parse(iso)) / 3_600_000
}

export function buildVerificationContextSignature(
  snapshot: IncidentVerificationSnapshot,
): string {
  const memberKeys = [...snapshot.members]
    .sort((a, b) => a.event_id.localeCompare(b.event_id))
    .map((m) => ({
      event_id: m.event_id,
      lifecycle_state: m.lifecycle_state,
      last_detected_at: m.last_detected_at,
      verification_score: m.verification_score,
    }))

  return hashVerificationSignature({
    model: FIRE_VERIFICATION_MODEL_VERSION,
    incident_id: snapshot.incident_id,
    incident_status: snapshot.incident_status,
    verification_score: snapshot.verification_score,
    verification_level: snapshot.verification_level,
    action_level: snapshot.action_level,
    evidence_status: snapshot.evidence_status,
    last_observed_at: snapshot.last_observed_at,
    active_event_count: snapshot.active_event_count,
    members: memberKeys,
    component_states: [...snapshot.component_evidence_states]
      .sort((a, b) => a.component.localeCompare(b.component))
      .map((s) => `${s.component}:${s.state}`),
    findings_count: snapshot.active_findings.length,
  })
}

function computePlanPriority(
  snapshot: IncidentVerificationSnapshot,
  needs: ReturnType<typeof deriveVerificationNeeds>,
  hoursSinceLast: number,
): { priority: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 0

  const verificationComponent =
    (snapshot.verification_score / 100) * PLAN_PRIORITY_WEIGHTS.verification_score * 100
  score += verificationComponent
  if (snapshot.verification_score >= 50) {
    reasons.push('Puntuación de verificación elevada')
  }

  const urgencyComponent =
    (hoursSinceLast <= FIRE_VERIFICATION_THRESHOLDS.recentActivityWindowHours ? 1 : 0.5) *
    PLAN_PRIORITY_WEIGHTS.urgency *
    100
  score += urgencyComponent
  if (hoursSinceLast <= 12) reasons.push('Ventana temporal corta para actividad reciente')

  const decayComponent =
    (hoursSinceLast >= FIRE_VERIFICATION_THRESHOLDS.evidenceDecayUrgentHours ? 0.8 : 0.3) *
    PLAN_PRIORITY_WEIGHTS.evidence_decay *
    100
  score += decayComponent
  if (hoursSinceLast >= 36) reasons.push('Riesgo de pérdida de evidencia verificable')

  if (needs.some((n) => n.need_type === 'obtain_visual_ground_evidence')) {
    score += PLAN_PRIORITY_WEIGHTS.action_unlock * 100
    reasons.push('Evidencia visual podría reducir incertidumbre operacional')
  }

  if (snapshot.incident_status === 'open') {
    score += PLAN_PRIORITY_WEIGHTS.lifecycle * 100
    reasons.push('Incidente abierto requiere plan activo')
  }

  return { priority: Math.min(100, Math.round(score)), reasons }
}

export function evaluateVerificationPlan(input: {
  snapshot: IncidentVerificationSnapshot
  evaluatedAt: string
}): VerificationPlanResult {
  const started = Date.now()
  const { snapshot, evaluatedAt } = input
  const contextSignature = buildVerificationContextSignature(snapshot)
  const hoursSinceLast = hoursSince(snapshot.last_observed_at, evaluatedAt)

  const derivedNeeds = sortNeedsDeterministic(
    deriveVerificationNeeds(snapshot, evaluatedAt),
  )

  if (isVerificationNotRequired(snapshot, derivedNeeds)) {
    const reasons = ['Verificación no requerida según puntuación y nivel actuales']
    for (const r of reasons) assertSafeVerificationCopy(r)
    return {
      incident_id: snapshot.incident_id,
      status: 'not_required',
      verification_model_version: FIRE_VERIFICATION_MODEL_VERSION,
      context_signature: contextSignature,
      evaluated_at: evaluatedAt,
      plan_priority: 10,
      plan_reasons: reasons,
      plan_limitations: ['Sin necesidades de verificación activas en este momento'],
      recommended_window: { start_hours: 0, end_hours: 0, label: 'No aplica' },
      incident_snapshot: snapshot,
      needs: [],
      mission_candidate_pending: false,
      warnings: [],
      duration_ms: Date.now() - started,
    }
  }

  const needsWithMethods = derivedNeeds.map((need) => {
    const ranked = rankMethodsForNeed(need, hoursSinceLast)
    return {
      ...need,
      recommended_method: ranked.recommended,
      alternative_methods: ranked.alternatives,
      selection_reason: ranked.selection_reason,
    }
  })

  dedupeMethodsAcrossNeeds(needsWithMethods)

  const allBlocked = needsWithMethods.every((n) => !n.recommended_method)
  const hasBlockedOnly = needsWithMethods.some(
    (n) => !n.recommended_method && n.alternative_methods.every((a) => a.is_blocked),
  )

  let status: VerificationPlanResult['status'] = 'ready'
  if (needsWithMethods.length === 0) status = 'not_required'
  else if (allBlocked || hasBlockedOnly) status = 'blocked'
  else if (needsWithMethods.some((n) => !n.recommended_method)) status = 'draft'

  const { priority, reasons: planReasons } = computePlanPriority(
    snapshot,
    derivedNeeds,
    hoursSinceLast,
  )

  const maxWindow = Math.max(...derivedNeeds.map((n) => n.recommended_window_hours), 24)
  const planLimitations = [
    'El plan propone métodos; no equivale a misión asignada',
    'Ausencia de nueva detección no satisface automáticamente una necesidad',
  ]

  const planReasonsFinal = [
    ...planReasons,
    `${derivedNeeds.length} necesidad(es) de verificación identificada(s)`,
  ]

  for (const r of planReasonsFinal) assertSafeVerificationCopy(r)
  for (const l of planLimitations) assertSafeVerificationCopy(l)
  for (const n of needsWithMethods) {
    assertSafeVerificationCopy(n.need_question)
    assertSafeVerificationCopy(n.selection_reason)
    for (const r of n.derivation_reasons) assertSafeVerificationCopy(r)
  }

  const missionCandidatePending =
    status === 'ready' && needsWithMethods.some((n) => n.recommended_method != null)

  return {
    incident_id: snapshot.incident_id,
    status,
    verification_model_version: FIRE_VERIFICATION_MODEL_VERSION,
    context_signature: contextSignature,
    evaluated_at: evaluatedAt,
    plan_priority: priority,
    plan_reasons: planReasonsFinal,
    plan_limitations: planLimitations,
    recommended_window: {
      start_hours: 0,
      end_hours: maxWindow,
      label: `Ventana recomendada: ${maxWindow}h`,
    },
    incident_snapshot: snapshot,
    needs: needsWithMethods,
    mission_candidate_pending: missionCandidatePending,
    warnings: [],
    duration_ms: Date.now() - started,
  }
}

export const genericVerificationPlanningEngine = {
  evaluate: evaluateVerificationPlan,
  modelVersion: FIRE_VERIFICATION_MODEL_VERSION,
  buildContextSignature: buildVerificationContextSignature,
}
