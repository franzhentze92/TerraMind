import type {
  DerivedVerificationNeed,
  IncidentVerificationSnapshot,
  VerificationNeedType,
} from '@/modules/verification/verification.types'
import {
  FIRE_VERIFICATION_NEED_DEFS,
  FIRE_VERIFICATION_THRESHOLDS,
} from '@/modules/verification/config/fire-verification.config'

const MATERIAL_CONTEXT_COMPONENTS = new Set([
  'land_cover',
  'protected_area',
  'population',
])

function hoursSince(iso: string, evaluatedAt: string): number {
  return (Date.parse(evaluatedAt) - Date.parse(iso)) / 3_600_000
}

function buildNeed(
  needType: VerificationNeedType,
  priority: number,
  reasons: string[],
  windowHours?: number,
): DerivedVerificationNeed {
  const def = FIRE_VERIFICATION_NEED_DEFS[needType]
  return {
    need_type: needType,
    need_question: def.question,
    priority,
    derivation_reasons: reasons,
    evidence_minimum: [...def.evidence_minimum],
    success_criteria: def.success_criteria,
    inconclusive_criteria: def.inconclusive_criteria,
    failure_criteria: def.failure_criteria,
    recommended_window_hours: windowHours ?? def.default_window_hours,
  }
}

function hasOnlyFirmsSources(snapshot: IncidentVerificationSnapshot): boolean {
  const products = snapshot.members.flatMap((m) => m.source_products)
  if (products.length === 0) return true
  const uniquePrefixes = new Set(products.map((p) => (p.split('_')[0] ?? p).toUpperCase()))
  return uniquePrefixes.size <= 1 && [...uniquePrefixes][0]?.includes('VIIRS') !== false
}

export function deriveVerificationNeeds(
  snapshot: IncidentVerificationSnapshot,
  evaluatedAt: string,
): DerivedVerificationNeed[] {
  const needs: DerivedVerificationNeed[] = []
  const hoursSinceLast = hoursSince(snapshot.last_observed_at, evaluatedAt)

  if (
    snapshot.verification_score <= FIRE_VERIFICATION_THRESHOLDS.notRequiredMaxVerificationScore &&
    ['not_required', 'useful'].includes(snapshot.verification_level) &&
    snapshot.incident_status !== 'resolved'
  ) {
    return []
  }

  if (snapshot.incident_status === 'resolved') {
    needs.push(
      buildNeed('verify_incident_resolution', 55, [
        'Incidente en estado resuelto requiere evaluación de cierre operacional',
      ]),
    )
    return needs
  }

  const hasReactivationSignal = snapshot.members.some(
    (m) => m.lifecycle_state === 'active' || m.lifecycle_state === 'expanding',
  )
  if (
    snapshot.incident_status === 'monitoring' &&
    hasReactivationSignal &&
    hoursSinceLast <= FIRE_VERIFICATION_THRESHOLDS.recentActivityWindowHours
  ) {
    needs.push(
      buildNeed('verify_reactivation', 70, [
        'Nueva señal correlacionada en incidente en monitoreo',
      ]),
    )
  }

  if (hoursSinceLast <= FIRE_VERIFICATION_THRESHOLDS.recentActivityWindowHours) {
    needs.push(
      buildNeed('confirm_recent_activity', 80, [
        'Actividad térmica reciente requiere verificación de continuidad',
      ]),
    )
  } else if (hoursSinceLast <= FIRE_VERIFICATION_THRESHOLDS.persistenceAssessmentWindowHours) {
    needs.push(
      buildNeed('assess_event_persistence', 60, [
        'Evaluar persistencia o declinación de la señal térmica',
      ]),
    )
  }

  if (
    snapshot.verification_score >= FIRE_VERIFICATION_THRESHOLDS.highUncertaintyMinScore ||
    snapshot.verification_level === 'high_priority' ||
    snapshot.verification_level === 'recommended'
  ) {
    if (!needs.some((n) => n.need_type === 'obtain_visual_ground_evidence')) {
      needs.push(
        buildNeed('obtain_visual_ground_evidence', 75, [
          'Alta incertidumbre de verificación requiere evidencia visual adicional',
        ]),
      )
    }
  }

  if (snapshot.active_event_count > 1 || snapshot.event_count > 1) {
    needs.push(
      buildNeed('assess_spatial_extent', 50, [
        'Múltiples eventos o detecciones requieren evaluar extensión territorial',
      ]),
    )
  } else if (hoursSinceLast <= FIRE_VERIFICATION_THRESHOLDS.spatialExtentStaleHours) {
    needs.push(
      buildNeed('assess_spatial_extent', 45, [
        'Señal reciente sin estimación consolidada de extensión',
      ]),
    )
  }

  for (const state of snapshot.component_evidence_states) {
    if (!MATERIAL_CONTEXT_COMPONENTS.has(state.component)) continue
    if (state.state === 'missing_context') {
      const map: Record<string, VerificationNeedType> = {
        land_cover: 'clarify_land_cover_context',
        protected_area: 'clarify_protected_area_relationship',
        population: 'improve_population_context',
      }
      const needType = map[state.component]
      if (needType && !needs.some((n) => n.need_type === needType)) {
        needs.push(
          buildNeed(needType, 55, [
            `Contexto material faltante: ${state.note || state.component}`,
          ]),
        )
      }
    } else if (state.state === 'uncertain_context') {
      const map: Record<string, VerificationNeedType> = {
        land_cover: 'clarify_land_cover_context',
        protected_area: 'clarify_protected_area_relationship',
        population: 'improve_population_context',
      }
      const needType = map[state.component]
      if (
        needType &&
        snapshot.verification_score >= 30 &&
        !needs.some((n) => n.need_type === needType)
      ) {
        needs.push(
          buildNeed(needType, 45, [
            `Contexto material incierto: ${state.note || state.component}`,
          ]),
        )
      }
    }
  }

  if (hasOnlyFirmsSources(snapshot) && snapshot.verification_score >= 35) {
    needs.push(
      buildNeed('differentiate_possible_non_fire_heat_source', 50, [
        'Diversidad de fuentes insuficiente; varias detecciones FIRMS no son corroboración independiente',
      ]),
    )
  }

  const actionCapped =
    snapshot.action_level === 'none' || snapshot.action_level === 'prepare'
  if (
    actionCapped &&
    snapshot.verification_score >= FIRE_VERIFICATION_THRESHOLDS.actionCapUnlockMinVerification
  ) {
    if (!needs.some((n) => n.need_type === 'obtain_visual_ground_evidence')) {
      needs.push(
        buildNeed('obtain_visual_ground_evidence', 65, [
          'Verificación adicional podría desbloquear evaluación de acción',
        ]),
      )
    }
  }

  if (hoursSinceLast >= FIRE_VERIFICATION_THRESHOLDS.evidenceDecayUrgentHours) {
    for (const n of needs) {
      if (n.need_type === 'obtain_visual_ground_evidence') {
        n.priority = Math.min(100, n.priority + 10)
        n.derivation_reasons.push('Evidencia visual puede perder valor con el tiempo')
      }
    }
  }

  for (const finding of snapshot.active_findings) {
    if (finding.limitations.some((l) => l.includes('visual') || l.includes('campo'))) {
      if (!needs.some((n) => n.need_type === 'obtain_visual_ground_evidence')) {
        needs.push(
          buildNeed('obtain_visual_ground_evidence', 60, [
            `Hallazgo ${finding.finding_type} indica necesidad de evidencia visual`,
          ]),
        )
      }
    }
  }

  const unique = new Map<VerificationNeedType, DerivedVerificationNeed>()
  for (const n of needs) {
    const existing = unique.get(n.need_type)
    if (!existing || n.priority > existing.priority) unique.set(n.need_type, n)
    else if (existing) {
      existing.derivation_reasons = [
        ...new Set([...existing.derivation_reasons, ...n.derivation_reasons]),
      ]
    }
  }

  return [...unique.values()]
}

export function isVerificationNotRequired(
  snapshot: IncidentVerificationSnapshot,
  needs: DerivedVerificationNeed[],
): boolean {
  return (
    needs.length === 0 &&
    snapshot.verification_score <= FIRE_VERIFICATION_THRESHOLDS.notRequiredMaxVerificationScore &&
    ['not_required', 'useful'].includes(snapshot.verification_level)
  )
}
