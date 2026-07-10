import {
  FIRE_INCIDENT_CORRELATION,
  FIRE_INCIDENT_CORRELATION_MODEL_VERSION,
} from '@/modules/incidents/config/fire-incident-correlation.config'
import {
  isEventEligibleForIncident,
  scoreEventPairCorrelation,
  scoreIncidentCorrelation,
} from '@/modules/incidents/correlation/fire-event-correlation'
import { assertSafeIncidentCopy } from '@/modules/incidents/incidents-copy-guard'
import {
  hashIncidentSignature,
  sortEventsDeterministic,
  type CorrelationDecision,
  type CorrelationEvaluationResult,
  type CorrelationScoreBreakdown,
  type IncidentCandidateSnapshot,
  type IncidentEventSnapshot,
} from '@/modules/incidents/incidents.types'

export function buildIncidentContextSignature(input: {
  event: IncidentEventSnapshot
  peerIds: string[]
  incidentIds: string[]
}): string {
  return hashIncidentSignature({
    model: FIRE_INCIDENT_CORRELATION_MODEL_VERSION,
    event_id: input.event.event_id,
    lifecycle_state: input.event.lifecycle_state,
    attention_level: input.event.attention_level,
    verification_level: input.event.verification_level,
    active_incident_id: input.event.active_incident_id,
    last_detected_at: input.event.last_detected_at,
    peer_ids: [...input.peerIds].sort(),
    incident_ids: [...input.incidentIds].sort(),
  })
}

export function evaluateFireIncidentCorrelation(input: {
  event: IncidentEventSnapshot
  peerEvents: IncidentEventSnapshot[]
  candidateIncidents: IncidentCandidateSnapshot[]
  evaluatedAt: string
}): CorrelationEvaluationResult {
  const started = Date.now()
  const eligibility = isEventEligibleForIncident(input.event)
  const peerIds = sortEventsDeterministic(input.peerEvents).map((p) => p.event_id)
  const incidentIds = input.candidateIncidents.map((i) => i.incident_id).sort()
  const contextSignature = buildIncidentContextSignature({
    event: input.event,
    peerIds,
    incidentIds,
  })

  if (!eligibility.eligible) {
    const reasons = [
      'Evento no elegible para crear o actualizar incidente automáticamente',
      ...eligibility.reasons,
    ]
    for (const r of reasons) assertSafeIncidentCopy(r)
    return {
      event_type: input.event.event_type,
      event_id: input.event.event_id,
      correlation_decision: 'no_action',
      correlation_model_version: FIRE_INCIDENT_CORRELATION_MODEL_VERSION,
      context_signature: contextSignature,
      evaluated_at: input.evaluatedAt,
      target_incident_id: null,
      merge_target_incident_id: null,
      scores: emptyScores(),
      correlation_reasons: reasons,
      correlation_limitations: ['Sin acción automática para eventos no elegibles'],
      rejected_reasons: eligibility.reasons,
      candidates_considered: [],
      evidence_snapshot: { eligibility },
      warnings: [],
      duration_ms: Date.now() - started,
    }
  }

  const candidates: CorrelationEvaluationResult['candidates_considered'] = []
  const rejectedReasons: string[] = []
  const limitations: string[] = [
    'La correlación es conservadora; la proximidad no implica la misma situación operacional',
  ]

  let bestIncident: {
    id: string
    scores: CorrelationScoreBreakdown
    reasons: string[]
  } | null = null

  for (const incident of input.candidateIncidents) {
    const scored = scoreIncidentCorrelation(input.event, incident)
    const accepted = scored.correlation_score >= FIRE_INCIDENT_CORRELATION.attachMinCorrelationScore
    candidates.push({
      kind: 'incident',
      id: incident.incident_id,
      scores: scored,
      accepted,
    })
    if (!accepted) rejectedReasons.push(...scored.rejected_reasons)
    if (accepted && (!bestIncident || scored.correlation_score > bestIncident.scores.correlation_score)) {
      bestIncident = {
        id: incident.incident_id,
        scores: scored,
        reasons: [
          'Proximidad espacial y ventana temporal compatibles con incidente existente',
        ],
      }
    }
  }

  let bestPeer: {
    id: string
    scores: CorrelationScoreBreakdown & { rejected_reasons: string[] }
    reasons: string[]
  } | null = null

  for (const peer of input.peerEvents) {
    const scored = scoreEventPairCorrelation(input.event, peer)
    const accepted = scored.correlation_score >= FIRE_INCIDENT_CORRELATION.attachMinCorrelationScore
    candidates.push({
      kind: 'event',
      id: peer.event_id,
      scores: scored,
      accepted,
    })
    if (!accepted) rejectedReasons.push(...scored.rejected_reasons)
    if (accepted && (!bestPeer || scored.correlation_score > bestPeer.scores.correlation_score)) {
      bestPeer = {
        id: peer.event_id,
        scores: scored,
        reasons: ['Evento territorial correlacionable por espacio y tiempo'],
      }
    }
  }

  let decision: CorrelationDecision = 'keep_separate'
  let targetIncidentId: string | null = null
  const correlationReasons: string[] = [...eligibility.reasons]

  if (input.event.active_incident_id) {
    decision = 'attach_to_existing'
    targetIncidentId = input.event.active_incident_id
    correlationReasons.push('Reevaluación de membresía activa existente')
  } else if (
    bestIncident &&
    bestIncident.scores.correlation_score >= FIRE_INCIDENT_CORRELATION.attachMinCorrelationScore
  ) {
    decision = 'attach_to_existing'
    targetIncidentId = bestIncident.id
    correlationReasons.push(...bestIncident.reasons)
  } else if (
    bestIncident &&
    bestIncident.scores.correlation_score >= FIRE_INCIDENT_CORRELATION.manualReviewMinCorrelationScore
  ) {
    decision = 'manual_review_recommended'
    targetIncidentId = bestIncident.id
    correlationReasons.push('Evidencia insuficiente para asociación automática a incidente existente')
  } else if (eligibility.eligible) {
    decision = 'create_new_incident'
    if (bestPeer && bestPeer.scores.correlation_score >= FIRE_INCIDENT_CORRELATION.attachMinCorrelationScore) {
      correlationReasons.push(
        'Eventos correlacionados sin incidente previo; se crea situación operacional individual conservadora',
      )
    } else {
      correlationReasons.push('Evento elegible sin correlación suficiente para fusionar con otro incidente')
    }
  } else {
    decision = 'keep_separate'
    correlationReasons.push('Sin evidencia suficiente para asociar o crear incidente')
  }

  const finalScores =
    bestIncident?.scores ?? bestPeer?.scores ?? emptyScores()

  for (const r of correlationReasons) assertSafeIncidentCopy(r)
  for (const r of limitations) assertSafeIncidentCopy(r)

  return {
    event_type: input.event.event_type,
    event_id: input.event.event_id,
    correlation_decision: decision,
    correlation_model_version: FIRE_INCIDENT_CORRELATION_MODEL_VERSION,
    context_signature: contextSignature,
    evaluated_at: input.evaluatedAt,
    target_incident_id: targetIncidentId,
    merge_target_incident_id: null,
    scores: finalScores,
    correlation_reasons: correlationReasons,
    correlation_limitations: limitations,
    rejected_reasons: [...new Set(rejectedReasons)],
    candidates_considered: candidates,
    evidence_snapshot: {
      eligibility,
      best_peer_id: bestPeer?.id ?? null,
      best_incident_id: bestIncident?.id ?? null,
    },
    warnings: [],
    duration_ms: Date.now() - started,
  }
}

function emptyScores(): CorrelationScoreBreakdown {
  return {
    correlation_score: 0,
    spatial_score: 0,
    temporal_score: 0,
    semantic_score: 0,
    source_diversity_score: 0,
    lifecycle_compatibility: 0,
  }
}

export const genericIncidentCorrelationEngine = {
  evaluate: evaluateFireIncidentCorrelation,
  modelVersion: FIRE_INCIDENT_CORRELATION_MODEL_VERSION,
  buildContextSignature: buildIncidentContextSignature,
}
