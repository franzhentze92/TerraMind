import {
  FIRE_LIFECYCLE_ALLOWED_TRANSITIONS,
  FIRE_LIFECYCLE_CORRELATION,
  FIRE_LIFECYCLE_MODEL_VERSION,
  FIRE_LIFECYCLE_WINDOWS,
  hoursBetween,
} from '@/modules/lifecycle/config/fire-lifecycle.config'
import { detectionSpreadHa } from '@/modules/lifecycle/correlation/fire-detection-correlation'
import {
  hashLifecycleSignature,
  isTransitionAllowed,
  sortDetectionsDeterministic,
  type FireLifecycleState,
  type LifecycleEvaluationSnapshot,
  type LifecycleRuleResult,
} from '@/modules/lifecycle/lifecycle.types'

function detectionsInWindow(
  snapshot: LifecycleEvaluationSnapshot,
  evaluatedAt: string,
  windowHours: number,
): typeof snapshot.detections {
  return snapshot.detections.filter(
    (d) => hoursBetween(d.acquired_at, evaluatedAt) <= windowHours,
  )
}

function isExpanding(
  snapshot: LifecycleEvaluationSnapshot,
  evaluatedAt: string,
): { expanding: boolean; reason: string; evidence: Record<string, unknown> } {
  const recent = detectionsInWindow(snapshot, evaluatedAt, FIRE_LIFECYCLE_WINDOWS.activeHours)
  const prior = snapshot.detections.filter((d) => {
    const h = hoursBetween(d.acquired_at, evaluatedAt)
    return h > FIRE_LIFECYCLE_WINDOWS.activeHours && h <= FIRE_LIFECYCLE_WINDOWS.persistenceWindowHours
  })

  const recentSpread = detectionSpreadHa(recent)
  const priorSpread = detectionSpreadHa(prior.length ? prior : recent.slice(0, Math.max(1, recent.length - 1)))

  const countGrowth =
    prior.length > 0
      ? ((recent.length - prior.length) / prior.length) * 100
      : recent.length > 1
        ? 50
        : 0

  const areaGrowth =
    priorSpread && recentSpread && priorSpread > 0
      ? ((recentSpread - priorSpread) / priorSpread) * 100
      : 0

  const expanding =
    countGrowth >= FIRE_LIFECYCLE_CORRELATION.expansionDetectionGrowthPct ||
    areaGrowth >= FIRE_LIFECYCLE_CORRELATION.expansionAreaGrowthPct

  return {
    expanding,
    reason: expanding
      ? 'Señal conservadora de expansión espacial o de actividad; no constituye propagación confirmada'
      : 'Sin señal de expansión significativa',
    evidence: {
      recent_detection_count: recent.length,
      prior_detection_count: prior.length,
      count_growth_pct: Math.round(countGrowth),
      area_growth_pct: Math.round(areaGrowth),
      recent_spread_ha: recentSpread,
      prior_spread_ha: priorSpread,
    },
  }
}

function isDeclining(
  snapshot: LifecycleEvaluationSnapshot,
  evaluatedAt: string,
): boolean {
  const recent = detectionsInWindow(snapshot, evaluatedAt, FIRE_LIFECYCLE_WINDOWS.activeHours)
  const prior = snapshot.detections.filter((d) => {
    const h = hoursBetween(d.acquired_at, evaluatedAt)
    return h > FIRE_LIFECYCLE_WINDOWS.activeHours && h <= FIRE_LIFECYCLE_WINDOWS.persistenceWindowHours
  })
  if (!prior.length) return false
  const drop = ((prior.length - recent.length) / prior.length) * 100
  return drop >= FIRE_LIFECYCLE_CORRELATION.decliningRecentDetectionDropPct
}

export function evaluateFireLifecycleState(
  snapshot: LifecycleEvaluationSnapshot,
  evaluatedAt: string,
): LifecycleRuleResult {
  const current = snapshot.lifecycle_state ?? 'detected'
  const sorted = sortDetectionsDeterministic(snapshot.detections)
  const sourceIds = sorted.map((d) => d.id)
  const hoursSinceLast = hoursBetween(snapshot.last_detected_at, evaluatedAt)
  const recentInActive = hoursSinceLast <= FIRE_LIFECYCLE_WINDOWS.activeHours

  const baseEvidence = {
    hours_since_last_detection: Math.round(hoursSinceLast * 10) / 10,
    detection_count: snapshot.detection_count,
    persistence_hours: snapshot.persistence_hours,
    validation_status: snapshot.validation_status,
    correlation_note:
      'Las detecciones correlacionadas actualizan el evento existente; no crean eventos duplicados',
  }

  if (current === 'invalidated') {
    return {
      proposed_state: 'invalidated',
      transition_rule: 'FIRE_LIFECYCLE_INVALIDATED_HOLD_001',
      transition_reason: 'Evento invalidado; no se permite reactivación automática',
      correlation_kind: 'none',
      evidence_snapshot: baseEvidence,
      source_detection_ids: sourceIds,
    }
  }

  if (current === 'resolved' && !recentInActive) {
    return {
      proposed_state: 'resolved',
      transition_rule: 'FIRE_LIFECYCLE_RESOLVED_HOLD_001',
      transition_reason: 'Evento resuelto sin nueva actividad correlacionada',
      correlation_kind: 'none',
      evidence_snapshot: baseEvidence,
      source_detection_ids: sourceIds,
    }
  }

  if (recentInActive) {
    if (current === 'resolved') {
      return {
        proposed_state: 'reactivated',
        transition_rule: 'FIRE_LIFECYCLE_REACTIVATED_001',
        transition_reason:
          'Nueva detección correlacionada después de resolución; el evento pasa por reactivación',
        correlation_kind: 'reactivation',
        evidence_snapshot: { ...baseEvidence, reactivation: true },
        source_detection_ids: sourceIds,
      }
    }

    const expansion = isExpanding(snapshot, evaluatedAt)
    if (expansion.expanding && isTransitionAllowed(FIRE_LIFECYCLE_ALLOWED_TRANSITIONS, current, 'expanding')) {
      return {
        proposed_state: 'expanding',
        transition_rule: 'FIRE_LIFECYCLE_EXPANDING_001',
        transition_reason: expansion.reason,
        correlation_kind: 'expansion',
        evidence_snapshot: { ...baseEvidence, ...expansion.evidence },
        source_detection_ids: sourceIds,
      }
    }

    const persistentCount = detectionsInWindow(
      snapshot,
      evaluatedAt,
      FIRE_LIFECYCLE_WINDOWS.persistenceWindowHours,
    ).length
    if (
      persistentCount >= FIRE_LIFECYCLE_WINDOWS.persistenceMinDetections &&
      isTransitionAllowed(FIRE_LIFECYCLE_ALLOWED_TRANSITIONS, current, 'persistent')
    ) {
      return {
        proposed_state: 'persistent',
        transition_rule: 'FIRE_LIFECYCLE_PERSISTENT_001',
        transition_reason: 'Detecciones repetidas dentro de la ventana de persistencia',
        correlation_kind: 'persistence',
        evidence_snapshot: {
          ...baseEvidence,
          persistence_window_hours: FIRE_LIFECYCLE_WINDOWS.persistenceWindowHours,
          detections_in_window: persistentCount,
        },
        source_detection_ids: sourceIds,
      }
    }

    if (isDeclining(snapshot, evaluatedAt) && isTransitionAllowed(FIRE_LIFECYCLE_ALLOWED_TRANSITIONS, current, 'declining')) {
      return {
        proposed_state: 'declining',
        transition_rule: 'FIRE_LIFECYCLE_DECLINING_001',
        transition_reason: 'Reducción sostenida de frecuencia de detecciones recientes',
        correlation_kind: 'decline',
        evidence_snapshot: baseEvidence,
        source_detection_ids: sourceIds,
      }
    }

    const target: FireLifecycleState =
      current === 'detected' || current === 'reactivated' ? 'active' : current === 'inactive_monitoring' ? 'active' : 'active'

    return {
      proposed_state: target,
      transition_rule:
        current === 'inactive_monitoring'
          ? 'FIRE_LIFECYCLE_ACTIVE_FROM_MONITORING_001'
          : 'FIRE_LIFECYCLE_ACTIVE_001',
      transition_reason:
        current === 'inactive_monitoring'
          ? 'Actividad reciente sin haber estado resuelto; retorno a activo sin reactivación'
          : 'Detección reciente correlacionada con el evento',
      correlation_kind: current === 'reactivated' ? 'continuation' : 'continuation',
      evidence_snapshot: baseEvidence,
      source_detection_ids: sourceIds,
    }
  }

  if (hoursSinceLast <= FIRE_LIFECYCLE_WINDOWS.inactiveMonitoringHours) {
    return {
      proposed_state: 'inactive_monitoring',
      transition_rule: 'FIRE_LIFECYCLE_INACTIVE_MONITORING_001',
      transition_reason:
        'Sin detecciones recientes; se mantiene observación inactiva sin confirmar extinción',
      correlation_kind: 'inactivity',
      evidence_snapshot: {
        ...baseEvidence,
        inactive_monitoring_hours: FIRE_LIFECYCLE_WINDOWS.inactiveMonitoringHours,
      },
      source_detection_ids: sourceIds,
    }
  }

  if (hoursSinceLast > FIRE_LIFECYCLE_WINDOWS.resolvedHours) {
    return {
      proposed_state: 'resolved',
      transition_rule: 'FIRE_LIFECYCLE_RESOLVED_001',
      transition_reason:
        'Ventana sin nueva actividad completada; el fenómeno dejó de mostrar señal dentro del umbral definido',
      correlation_kind: 'resolution',
      evidence_snapshot: {
        ...baseEvidence,
        resolved_hours: FIRE_LIFECYCLE_WINDOWS.resolvedHours,
      },
      source_detection_ids: sourceIds,
    }
  }

  return {
    proposed_state: current,
    transition_rule: 'FIRE_LIFECYCLE_NO_CHANGE_001',
    transition_reason: 'Sin cambio de estado en esta evaluación',
    correlation_kind: 'none',
    evidence_snapshot: baseEvidence,
    source_detection_ids: sourceIds,
  }
}

export function buildFireLifecycleContextSignature(
  snapshot: LifecycleEvaluationSnapshot,
): string {
  const sortedIds = sortDetectionsDeterministic(snapshot.detections).map((d) => d.id)
  return hashLifecycleSignature({
    model: FIRE_LIFECYCLE_MODEL_VERSION,
    entity_id: snapshot.entity_id,
    lifecycle_state: snapshot.lifecycle_state,
    last_detected_at: snapshot.last_detected_at,
    detection_count: snapshot.detection_count,
    detection_ids: sortedIds,
    validation_status: snapshot.validation_status,
  })
}
