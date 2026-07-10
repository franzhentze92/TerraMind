import {
  FIRE_INCIDENT_CORRELATION,
  FIRE_INCIDENT_ELIGIBILITY,
  haversineDistanceM,
  hoursBetween,
  temporalOverlapHours,
} from '@/modules/incidents/config/fire-incident-correlation.config'
import type {
  CorrelationScoreBreakdown,
  IncidentCandidateSnapshot,
  IncidentEventSnapshot,
} from '@/modules/incidents/incidents.types'

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, Math.round(v * 10000) / 10000))
}

function spatialScore(distanceM: number | null): number {
  if (distanceM == null) return 0
  if (distanceM > FIRE_INCIDENT_CORRELATION.separateMinDistanceM) return 0
  if (distanceM <= 500) return 1
  const ratio = 1 - distanceM / FIRE_INCIDENT_CORRELATION.attachMaxDistanceM
  return clamp01(ratio)
}

function temporalScore(
  a: { first_detected_at: string; last_detected_at: string },
  b: { first_detected_at: string; last_detected_at: string },
): number {
  const gap = Math.min(
    hoursBetween(a.first_detected_at, b.last_detected_at),
    hoursBetween(b.first_detected_at, a.last_detected_at),
  )
  if (gap > FIRE_INCIDENT_CORRELATION.temporalMaxGapHours) return 0
  const overlap = temporalOverlapHours(
    a.first_detected_at,
    a.last_detected_at,
    b.first_detected_at,
    b.last_detected_at,
  )
  if (overlap >= FIRE_INCIDENT_CORRELATION.temporalMinOverlapHours) return 1
  const ratio = 1 - gap / FIRE_INCIDENT_CORRELATION.temporalMaxGapHours
  return clamp01(ratio * 0.85)
}

function lifecycleCompatibility(
  a: string | null,
  b: string | null,
): number {
  if (!a || !b) return 0.5
  if (a === 'invalidated' || b === 'invalidated') return 0
  if (a === 'resolved' && b === 'resolved') return 0.7
  if (a === 'resolved' || b === 'resolved') return 0.35
  return 1
}

function semanticScore(): number {
  return 1
}

function sourceDiversityScore(
  aProducts: string[],
  bProducts: string[],
): number {
  const aSet = new Set(aProducts.map((p) => p.split('_')[0] ?? p))
  const bSet = new Set(bProducts.map((p) => p.split('_')[0] ?? p))
  const union = new Set([...aSet, ...bSet])
  if (union.size <= 1) return 0.2
  return clamp01(union.size / 3)
}

export function scoreEventPairCorrelation(
  source: IncidentEventSnapshot,
  target: IncidentEventSnapshot,
): CorrelationScoreBreakdown & {
  distance_m: number | null
  rejected_reasons: string[]
} {
  const rejected: string[] = []

  if (source.event_id === target.event_id) {
    return {
      correlation_score: 0,
      spatial_score: 0,
      temporal_score: 0,
      semantic_score: 0,
      source_diversity_score: 0,
      lifecycle_compatibility: 0,
      distance_m: 0,
      rejected_reasons: ['same_event'],
    }
  }

  if (
    source.lifecycle_state === 'invalidated' ||
    target.lifecycle_state === 'invalidated'
  ) {
    rejected.push('evento_invalidado')
    return {
      correlation_score: 0,
      spatial_score: 0,
      temporal_score: 0,
      semantic_score: 0,
      source_diversity_score: 0,
      lifecycle_compatibility: 0,
      distance_m: null,
      rejected_reasons: rejected,
    }
  }

  let distance_m: number | null = null
  if (
    source.centroid_lat != null &&
    source.centroid_lng != null &&
    target.centroid_lat != null &&
    target.centroid_lng != null
  ) {
    distance_m = haversineDistanceM(
      source.centroid_lat,
      source.centroid_lng,
      target.centroid_lat,
      target.centroid_lng,
    )
  } else {
    rejected.push('geometria_insuficiente')
  }

  if (
    source.department_id &&
    target.department_id &&
    source.department_id === target.department_id &&
    (distance_m == null || distance_m > FIRE_INCIDENT_CORRELATION.attachMaxDistanceM)
  ) {
    rejected.push('solo_coincidencia_administrativa')
  }

  const spatial = spatialScore(distance_m)
  const temporal = temporalScore(source, target)
  const semantic = semanticScore()
  const diversity = sourceDiversityScore(source.source_products, target.source_products)
  const lifecycle = lifecycleCompatibility(source.lifecycle_state, target.lifecycle_state)

  if (distance_m != null && distance_m > FIRE_INCIDENT_CORRELATION.separateMinDistanceM) {
    rejected.push('distancia_espacial_excesiva')
  }
  if (temporal === 0) rejected.push('ventanas_temporales_incompatibles')

  let correlation_score = clamp01(
    spatial * 0.4 + temporal * 0.3 + semantic * 0.1 + lifecycle * 0.15 + diversity * 0.05,
  )

  if (distance_m != null && distance_m > FIRE_INCIDENT_CORRELATION.separateMinDistanceM) {
    correlation_score = 0
  }
  if (temporal === 0) {
    correlation_score = Math.min(correlation_score, FIRE_INCIDENT_CORRELATION.manualReviewMinCorrelationScore - 0.01)
  }

  return {
    correlation_score,
    spatial_score: spatial,
    temporal_score: temporal,
    semantic_score: semantic,
    source_diversity_score: diversity,
    lifecycle_compatibility: lifecycle,
    distance_m,
    rejected_reasons: rejected,
  }
}

export function scoreIncidentCorrelation(
  source: IncidentEventSnapshot,
  incident: IncidentCandidateSnapshot,
): CorrelationScoreBreakdown & {
  distance_m: number | null
  rejected_reasons: string[]
} {
  const pseudoTarget: IncidentEventSnapshot = {
    ...source,
    event_id: incident.primary_event_id ?? incident.incident_id,
    centroid_lat: incident.centroid_lat,
    centroid_lng: incident.centroid_lng,
    first_detected_at: incident.first_observed_at,
    last_detected_at: incident.last_observed_at,
    lifecycle_state: 'active',
    active_incident_id: incident.incident_id,
  }
  const base = scoreEventPairCorrelation(source, pseudoTarget)
  if (['merged', 'invalidated', 'split'].includes(incident.status)) {
    base.rejected_reasons.push(`incidente_${incident.status}`)
    base.correlation_score = 0
  }
  return base
}

export function isEventEligibleForIncident(event: IncidentEventSnapshot): {
  eligible: boolean
  reasons: string[]
} {
  const reasons: string[] = []

  if (FIRE_INCIDENT_ELIGIBILITY.blockedLifecycleStates.includes(
    event.lifecycle_state as 'invalidated',
  )) {
    return { eligible: false, reasons: ['evento_invalidado'] }
  }

  if (
    FIRE_INCIDENT_ELIGIBILITY.resolvedCannotCreate &&
    event.lifecycle_state === 'resolved' &&
    !event.active_incident_id
  ) {
    return { eligible: false, reasons: ['evento_resuelto_sin_incidente_previo'] }
  }

  if (
    event.lifecycle_state &&
    (FIRE_INCIDENT_ELIGIBILITY.lifecycleStates as readonly string[]).includes(
      event.lifecycle_state,
    )
  ) {
    reasons.push(`lifecycle_${event.lifecycle_state}`)
  }

  if (
    event.attention_level &&
    (FIRE_INCIDENT_ELIGIBILITY.minAttentionLevels as readonly string[]).includes(
      event.attention_level,
    )
  ) {
    reasons.push(`attention_${event.attention_level}`)
  }

  if (
    event.verification_level &&
    (FIRE_INCIDENT_ELIGIBILITY.minVerificationLevels as readonly string[]).includes(
      event.verification_level,
    )
  ) {
    reasons.push(`verification_${event.verification_level}`)
  }

  if (event.active_incident_id) {
    reasons.push('reevaluacion_membresia_existente')
    return { eligible: true, reasons }
  }

  return { eligible: reasons.length > 0, reasons }
}
