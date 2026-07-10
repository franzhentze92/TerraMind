import {
  CRITICAL_LIMITATION_MARKERS,
  DOWNSTREAM_EFFECTS,
  MATERIAL_RESOLUTION_STATUSES,
  RESOLUTION_MODEL_VERSION,
} from '@/modules/verification/config/fire-verification-resolution.config'
import { assertSafeResolutionCopy } from '@/modules/verification/resolution/verification-resolution-copy-guard'
import type {
  ConflictAssessmentStatus,
  CorroborationLevel,
  EvidenceBundle,
  MissionOutcomeSnapshot,
  NeedResolutionResult,
  NeedResolutionScores,
  NeedResolutionSnapshot,
  NeedResolutionStatus,
  PlanResolutionSummary,
  ResolutionConflictInput,
  ValidatedEvidenceItem,
} from '@/modules/verification/resolution/verification-resolution.types'
import { hashResolutionContext } from '@/modules/verification/resolution/verification-resolution.types'

const USABLE_VALIDATION = new Set(['accepted', 'accepted_with_limitations', 'inconclusive'])
const USABLE_COVERAGE = new Set(['valid_coverage', 'valid_partial_coverage', 'inconclusive_coverage'])

const STRENGTH_ORDER = ['very_low', 'low', 'moderate', 'strong', 'very_strong'] as const

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function hoursBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null
  return Math.abs(Date.parse(b) - Date.parse(a)) / 3_600_000
}

function strengthRank(s: string): number {
  const idx = STRENGTH_ORDER.indexOf(s as (typeof STRENGTH_ORDER)[number])
  return idx >= 0 ? idx : 0
}

function maxStrength(items: ValidatedEvidenceItem[]): string {
  if (items.length === 0) return 'very_low'
  return items.reduce(
    (best, item) => (strengthRank(item.evidence_strength) > strengthRank(best) ? item.evidence_strength : best),
    'very_low',
  )
}

function isUsableForNeed(item: ValidatedEvidenceItem, needId: string): boolean {
  if (!USABLE_VALIDATION.has(item.validation_status)) return false
  if (!item.valid_coverage_status || !USABLE_COVERAGE.has(item.valid_coverage_status)) return false
  if (item.verification_need_id && item.verification_need_id !== needId) return false
  return true
}

function hasCriticalLimitation(limitations: string[]): boolean {
  const joined = limitations.join(' ').toLowerCase()
  return CRITICAL_LIMITATION_MARKERS.some((m) => joined.includes(m.toLowerCase()))
}

function sortEvidence(items: ValidatedEvidenceItem[]): ValidatedEvidenceItem[] {
  return [...items].sort((a, b) => a.submission_id.localeCompare(b.submission_id))
}

function sourceKey(item: ValidatedEvidenceItem): string {
  return `${item.source_type}:${item.submitted_by_id}:${item.source_device ?? 'none'}`
}

function computeCorroboration(used: ValidatedEvidenceItem[]): {
  level: CorroborationLevel
  independent_sources: string[]
  score: number
} {
  if (used.length === 0) return { level: 'single_evidence', independent_sources: [], score: 0 }
  const keys = [...new Set(used.map(sourceKey))]
  const types = [...new Set(used.map((e) => e.evidence_type))]
  if (keys.length >= 2 && types.length >= 2) {
    return { level: 'cross_method_evidence', independent_sources: keys, score: 85 }
  }
  if (keys.length >= 2) {
    return { level: 'multiple_independent_evidence', independent_sources: keys, score: 72 }
  }
  if (used.length >= 2) {
    return { level: 'multiple_correlated_evidence', independent_sources: keys, score: 48 }
  }
  return { level: 'single_evidence', independent_sources: keys, score: 30 }
}

function assessConflicts(
  conflicts: ResolutionConflictInput[],
  evidence: ValidatedEvidenceItem[],
): { status: ConflictAssessmentStatus; reasons: string[]; penalty: number } {
  if (conflicts.length === 0) {
    return { status: 'none', reasons: [], penalty: 0 }
  }

  const reasons: string[] = []
  let material = 0
  let explainable = 0

  for (const c of conflicts.sort((a, b) => a.submission_id_a.localeCompare(b.submission_id_a))) {
    const hours = hoursBetween(c.captured_at_a, c.captured_at_b)
    if (hours != null && hours >= 4) {
      explainable += 1
      reasons.push(
        `Diferencia temporal explicable (${Math.round(hours)}h) en ${c.conflict_field ?? c.conflict_type}`,
      )
      continue
    }

    const itemA = evidence.find((e) => e.submission_id === c.submission_id_a)
    const itemB = evidence.find((e) => e.submission_id === c.submission_id_b)
    if (itemA && itemB && sourceKey(itemA) === sourceKey(itemB)) {
      explainable += 1
      reasons.push('Evidencias correlacionadas de la misma fuente; no se trata como conflicto material')
      continue
    }

    material += 1
    reasons.push(c.description)
  }

  if (material > 0) {
    return {
      status: material > 1 ? 'material_conflict' : 'unresolved_conflict',
      reasons,
      penalty: clamp(material * 35),
    }
  }
  if (explainable > 0) {
    return { status: 'explainable_difference', reasons, penalty: clamp(explainable * 8) }
  }
  return { status: 'insufficient_context', reasons, penalty: 15 }
}

function buildEvidenceBundle(
  needId: string,
  allEvidence: ValidatedEvidenceItem[],
): { bundle: EvidenceBundle; used: ValidatedEvidenceItem[] } {
  const sorted = sortEvidence(allEvidence)
  const used: ValidatedEvidenceItem[] = []
  const discarded: EvidenceBundle['submissions_discarded'] = []

  for (const item of sorted) {
    if (!USABLE_VALIDATION.has(item.validation_status)) {
      discarded.push({ submission_id: item.submission_id, reason: `Validación ${item.validation_status}` })
      continue
    }
    if (!item.valid_coverage_status || item.valid_coverage_status === 'invalid_coverage') {
      discarded.push({ submission_id: item.submission_id, reason: 'Cobertura inválida o irrelevante' })
      continue
    }
    if (item.verification_need_id && item.verification_need_id !== needId) {
      discarded.push({ submission_id: item.submission_id, reason: 'Evidencia no vinculada a esta necesidad' })
      continue
    }
    used.push(item)
  }

  const corroboration = computeCorroboration(used)
  const timestamps = used.map((e) => e.captured_at).filter(Boolean) as string[]
  timestamps.sort()

  return {
    used,
    bundle: {
      submissions_considered: sorted.map((e) => e.submission_id),
      validations_used: used.map((e) => e.validation_id),
      submissions_discarded: discarded,
      independent_sources: corroboration.independent_sources,
      corroboration_level: corroboration.level,
      combined_strength: maxStrength(used),
      temporal_coverage: {
        earliest: timestamps[0] ?? null,
        latest: timestamps[timestamps.length - 1] ?? null,
      },
      spatial_coverage_note:
        used.length > 0
          ? `Cobertura espacial basada en ${used.length} evidencia(s) utilizable(s)`
          : 'Sin cobertura espacial utilizable',
      contradictions: [],
      limitations: [...new Set(used.flatMap((e) => e.limitations))],
    },
  }
}

function computeScores(input: {
  used: ValidatedEvidenceItem[]
  corroborationScore: number
  conflictPenalty: number
  windowHours: number
  incidentLastObserved: string | null
}): NeedResolutionScores {
  const { used, corroborationScore, conflictPenalty, windowHours, incidentLastObserved } = input
  if (used.length === 0) {
    return {
      evidence_sufficiency_score: 0,
      coverage_score: 0,
      corroboration_score: 0,
      conflict_penalty: conflictPenalty,
      temporal_fit_score: 0,
      spatial_fit_score: 0,
      resolution_confidence_score: 0,
    }
  }

  const coverageScore = clamp(
    used.reduce((sum, e) => {
      if (e.valid_coverage_status === 'valid_coverage') return sum + 100
      if (e.valid_coverage_status === 'valid_partial_coverage') return sum + 65
      return sum + 40
    }, 0) / used.length,
  )

  const temporalFit = clamp(
    used.reduce((sum, e) => {
      let score = e.temporal_relevance_score
      if (incidentLastObserved && e.captured_at) {
        const h = hoursBetween(incidentLastObserved, e.captured_at)
        if (h != null && h <= windowHours) score = Math.max(score, 80)
      }
      return sum + score
    }, 0) / used.length,
  )

  const spatialFit = clamp(
    used.reduce((sum, e) => sum + e.spatial_relevance_score, 0) / used.length,
  )

  const sufficiency = clamp(
    used.reduce((sum, e) => sum + e.overall_quality_score, 0) / used.length,
  )

  const confidence = clamp(
    sufficiency * 0.3 +
      coverageScore * 0.2 +
      corroborationScore * 0.15 +
      temporalFit * 0.15 +
      spatialFit * 0.1 -
      conflictPenalty * 0.1,
  )

  return {
    evidence_sufficiency_score: sufficiency,
    coverage_score: coverageScore,
    corroboration_score: corroborationScore,
    conflict_penalty: conflictPenalty,
    temporal_fit_score: temporalFit,
    spatial_fit_score: spatialFit,
    resolution_confidence_score: confidence,
  }
}

function missionContribution(
  missions: MissionOutcomeSnapshot[],
  needId: string,
  hasUsableEvidence: boolean,
): { note: string; blocksSatisfaction: boolean } {
  const linked = missions.filter((m) => m.verification_need_id === needId)
  if (linked.length === 0) return { note: '', blocksSatisfaction: false }

  const completed = linked.filter((m) => m.status === 'completed')
  const inconclusive = linked.filter((m) => m.status === 'inconclusive')
  const cancelled = linked.filter((m) => ['cancelled', 'expired'].includes(m.status))

  if (completed.length > 0 && !hasUsableEvidence) {
    return {
      note: 'Misión completada sin evidencia suficiente para esta necesidad',
      blocksSatisfaction: true,
    }
  }
  if (inconclusive.length > 0 && !hasUsableEvidence) {
    return { note: 'Misión inconclusa; la necesidad permanece abierta o inconclusa', blocksSatisfaction: true }
  }
  if (cancelled.length > 0 && !hasUsableEvidence) {
    return { note: 'Misión cancelada o expirada sin evidencia alternativa', blocksSatisfaction: true }
  }
  return { note: '', blocksSatisfaction: false }
}

function resolveObtainVisualGroundEvidence(
  snapshot: NeedResolutionSnapshot,
  used: ValidatedEvidenceItem[],
  bundle: EvidenceBundle,
  conflict: ReturnType<typeof assessConflicts>,
  scores: NeedResolutionScores,
  missionNote: ReturnType<typeof missionContribution>,
): Omit<NeedResolutionResult, 'context_signature' | 'ok'> {
  const rules: string[] = ['obtain_visual_ground_evidence_v1']
  const reasons: string[] = []
  const limitations: string[] = []
  const uncertainties: string[] = []
  const followUp: string[] = []

  if (used.length === 0) {
    if (missionNote.blocksSatisfaction) {
      return baseResult('inconclusive', 'low', reasons, limitations, uncertainties, followUp, bundle, conflict, scores, rules, [
        missionNote.note,
        'Requiere verificación adicional con observación estructurada',
      ])
    }
    return baseResult('insufficient_evidence', 'very_low', reasons, limitations, uncertainties, followUp, bundle, conflict, scores, rules, [
      'Sin evidencia visual utilizable vinculada a la necesidad',
    ])
  }

  const structured = used.filter((e) => e.evidence_type === 'structured_observation')
  const best = used.reduce((a, b) => (a.overall_quality_score >= b.overall_quality_score ? a : b))

  if (conflict.status === 'material_conflict' || conflict.status === 'unresolved_conflict') {
    return baseResult('conflicting_evidence', maxStrength(used), reasons, limitations, uncertainties, followUp, bundle, conflict, scores, rules, [
      'Evidencias visuales con contradicción material',
    ], 'Solicitar fuente independiente')
  }

  const critical = used.some((e) => hasCriticalLimitation(e.limitations))
  const partialOnly = used.every((e) => e.valid_coverage_status === 'valid_partial_coverage')

  if (structured.length > 0 && best.overall_quality_score >= 70 && !critical && !partialOnly) {
    reasons.push('Observación estructurada aceptada con cobertura válida')
    reasons.push('Proximidad temporal y espacial dentro de umbrales mínimos')
    return baseResult('satisfied', maxStrength(used), reasons, limitations, uncertainties, followUp, bundle, conflict, scores, rules, [])
  }

  if (used.length > 0 && (partialOnly || best.validation_status === 'accepted_with_limitations')) {
    reasons.push('Evidencia utilizable con cobertura o precisión limitada')
    limitations.push(...bundle.limitations)
    followUp.push('Repetir observación con mejor visibilidad o proximidad')
    return baseResult('partially_satisfied', maxStrength(used), reasons, limitations, uncertainties, followUp, bundle, conflict, scores, rules, [])
  }

  if (best.temporal_relevance_score < 50 || best.spatial_relevance_score < 50) {
    uncertainties.push('Ajuste temporal o espacial débil')
    followUp.push('Ampliar área o esperar nueva observación')
    return baseResult('inconclusive', maxStrength(used), reasons, limitations, uncertainties, followUp, bundle, conflict, scores, rules, [
      'Visibilidad, distancia o timestamp insuficientes para cerrar la necesidad',
    ])
  }

  return baseResult('inconclusive', maxStrength(used), reasons, limitations, uncertainties, followUp, bundle, conflict, scores, rules, [
    'Evidencia aceptada no satisface criterios completos de observación visual',
  ])
}

function resolveConfirmRecentActivity(
  snapshot: NeedResolutionSnapshot,
  used: ValidatedEvidenceItem[],
  bundle: EvidenceBundle,
  conflict: ReturnType<typeof assessConflicts>,
  scores: NeedResolutionScores,
  missionNote: ReturnType<typeof missionContribution>,
): Omit<NeedResolutionResult, 'context_signature' | 'ok'> {
  const rules: string[] = ['confirm_recent_activity_v1']
  const reasons: string[] = []
  const limitations: string[] = []
  const uncertainties: string[] = []
  const followUp: string[] = []

  const thermal = used.filter((e) =>
    ['thermal_detection_review', 'satellite_observation', 'external_document'].includes(e.evidence_type),
  )
  const strongThermal = thermal.filter((e) => strengthRank(e.evidence_strength) >= strengthRank('strong'))

  if (conflict.status === 'material_conflict') {
    return baseResult('conflicting_evidence', maxStrength(used), reasons, limitations, uncertainties, followUp, bundle, conflict, scores, rules, [
      'Evidencias térmicas con contradicción material',
    ])
  }

  if (strongThermal.length > 0 && scores.temporal_fit_score >= 65) {
    reasons.push('Evidencia compatible con actividad reciente dentro de la ventana')
    return baseResult('satisfied', maxStrength(strongThermal), reasons, limitations, uncertainties, followUp, bundle, conflict, scores, rules, [])
  }

  if (used.length === 0) {
    if (missionNote.blocksSatisfaction) {
      return baseResult('inconclusive', 'low', reasons, limitations, uncertainties, followUp, bundle, conflict, scores, rules, [
        missionNote.note,
        'Ausencia de nueva detección no implica inactividad',
      ])
    }
    return baseResult('insufficient_evidence', 'very_low', reasons, limitations, uncertainties, followUp, bundle, conflict, scores, rules, [
      'Sin evidencia térmica utilizable en la ventana evaluada',
    ])
  }

  uncertainties.push('Ausencia de detección nueva no prueba inactividad')
  followUp.push('Esperar nueva observación satelital o ampliar ventana')
  return baseResult('inconclusive', maxStrength(used), reasons, limitations, uncertainties, followUp, bundle, conflict, scores, rules, [
    'Evidencia insuficiente para confirmar actividad reciente',
  ])
}

function resolveDifferentiateNonFire(
  used: ValidatedEvidenceItem[],
  bundle: EvidenceBundle,
  conflict: ReturnType<typeof assessConflicts>,
  scores: NeedResolutionScores,
): Omit<NeedResolutionResult, 'context_signature' | 'ok'> {
  const rules = ['differentiate_possible_non_fire_heat_source_v1']
  const reasons: string[] = []
  const followUp: string[] = []
  const compatible = used.filter((e) => {
    const obs = e.observation
    if (!obs) return false
    const hint = String(obs.possible_non_vegetation_source ?? obs.heat_source_type ?? '')
    return hint.length > 0 && hint !== 'vegetation_fire'
  })

  if (compatible.length > 0) {
    reasons.push('Evidencia compatible con posible fuente no vegetal')
    return baseResult('satisfied', maxStrength(compatible), reasons, [], [], followUp, bundle, conflict, scores, rules, [])
  }
  if (used.length === 0) {
    return baseResult('insufficient_evidence', 'very_low', reasons, [], [], followUp, bundle, conflict, scores, rules, [
      'Sin evidencia para distinguir fuente térmica alternativa',
    ])
  }
  return baseResult('inconclusive', maxStrength(used), reasons, [], ['Origen térmico aún ambiguo'], followUp, bundle, conflict, scores, rules, [
    'Evidencia no aclara el tipo de fuente térmica',
  ])
}

function resolveGenericNeed(
  needType: string,
  used: ValidatedEvidenceItem[],
  bundle: EvidenceBundle,
  conflict: ReturnType<typeof assessConflicts>,
  scores: NeedResolutionScores,
  missionNote: ReturnType<typeof missionContribution>,
): Omit<NeedResolutionResult, 'context_signature' | 'ok'> {
  const rules = [`${needType}_generic_v1`]
  const reasons: string[] = []
  const followUp: string[] = []

  if (conflict.status === 'material_conflict') {
    return baseResult('conflicting_evidence', maxStrength(used), reasons, [], [], followUp, bundle, conflict, scores, rules, [
      'Conflicto de evidencia en evaluación genérica',
    ])
  }
  if (used.length === 0) {
    if (missionNote.blocksSatisfaction) {
      return baseResult('inconclusive', 'low', reasons, [], [], followUp, bundle, conflict, scores, rules, [missionNote.note])
    }
    return baseResult('insufficient_evidence', 'very_low', reasons, [], [], followUp, bundle, conflict, scores, rules, [
      'Sin evidencia utilizable para esta necesidad',
    ])
  }
  const fullCoverage = used.some((e) => e.valid_coverage_status === 'valid_coverage' && e.overall_quality_score >= 70)
  if (fullCoverage && scores.resolution_confidence_score >= 65) {
    reasons.push('Cobertura y calidad suficientes según criterios genéricos')
    return baseResult('satisfied', maxStrength(used), reasons, bundle.limitations, [], followUp, bundle, conflict, scores, rules, [])
  }
  if (used.some((e) => e.valid_coverage_status === 'valid_partial_coverage')) {
    return baseResult('partially_satisfied', maxStrength(used), reasons, bundle.limitations, [], followUp, bundle, conflict, scores, rules, [
      'Evidencia parcialmente alineada con la necesidad',
    ])
  }
  return baseResult('inconclusive', maxStrength(used), reasons, bundle.limitations, [], followUp, bundle, conflict, scores, rules, [
    'Resultado inconcluso según criterios genéricos',
  ])
}

function baseResult(
  status: NeedResolutionStatus,
  strength: string,
  reasons: string[],
  limitations: string[],
  uncertainties: string[],
  followUp: string[],
  bundle: EvidenceBundle,
  conflict: { status: ConflictAssessmentStatus; reasons: string[] },
  scores: NeedResolutionScores,
  rules: string[],
  extraReasons: string[],
  alternativeMethod: string | null = null,
): Omit<NeedResolutionResult, 'context_signature' | 'ok'> {
  const allReasons = [...reasons, ...extraReasons]
  const downstream = deriveDownstreamEffects(status, bundle, scores)

  for (const text of [...allReasons, ...limitations, ...uncertainties, ...followUp]) {
    assertSafeResolutionCopy(text)
  }
  if (alternativeMethod) assertSafeResolutionCopy(alternativeMethod)

  return {
    resolution_status: status,
    resolution_confidence: scores.resolution_confidence_score,
    resolution_strength: strength,
    resolution_reasons: allReasons,
    resolution_limitations: limitations,
    remaining_uncertainties: uncertainties,
    recommended_follow_up: followUp,
    alternative_method_recommended: alternativeMethod,
    evidence_bundle: bundle,
    requirements_coverage: bundle.validations_used.map((_, i) => ({
      requirement_id: bundle.submissions_considered[i] ?? `req-${i}`,
      coverage_status: status === 'satisfied' ? 'covered' : 'partial',
      reason: allReasons[0] ?? 'Evaluación de cobertura',
    })),
    conflict_assessment: { status: conflict.status, reasons: conflict.reasons },
    scores,
    decision_rules: rules,
    downstream_effects: downstream,
    warnings: [],
  }
}

function deriveDownstreamEffects(
  status: NeedResolutionStatus,
  bundle: EvidenceBundle,
  scores: NeedResolutionScores,
): string[] {
  if (!MATERIAL_RESOLUTION_STATUSES.includes(status)) {
    if (status === 'insufficient_evidence' || status === 'inconclusive') {
      return ['verification_replanning_requested']
    }
    return []
  }

  const effects: string[] = []
  if (status === 'satisfied' || status === 'partially_satisfied') {
    effects.push('finding_reevaluation_requested', 'priority_reevaluation_requested')
    if (scores.temporal_fit_score >= 70) effects.push('lifecycle_reevaluation_requested')
    effects.push('incident_reevaluation_requested')
  }
  if (status === 'conflicting_evidence') {
    effects.push('finding_reevaluation_requested', 'verification_replanning_requested')
  }
  if (bundle.corroboration_level === 'multiple_independent_evidence') {
    if (!effects.includes('incident_reevaluation_requested')) effects.push('incident_reevaluation_requested')
  }
  return [...new Set(effects)].filter((e) => DOWNSTREAM_EFFECTS.includes(e as (typeof DOWNSTREAM_EFFECTS)[number]))
}

export function evaluateNeedResolution(snapshot: NeedResolutionSnapshot): NeedResolutionResult {
  const { bundle, used } = buildEvidenceBundle(snapshot.need_id, snapshot.validated_evidence)
  const corroboration = computeCorroboration(used)
  const conflict = assessConflicts(snapshot.conflicts, used)
  const scores = computeScores({
    used,
    corroborationScore: corroboration.score,
    conflictPenalty: conflict.penalty,
    windowHours: snapshot.recommended_window_hours,
    incidentLastObserved: snapshot.incident_last_observed_at,
  })
  const missionNote = missionContribution(snapshot.mission_outcomes, snapshot.need_id, used.length > 0)

  let core: Omit<NeedResolutionResult, 'context_signature' | 'ok'>
  switch (snapshot.need_type) {
    case 'obtain_visual_ground_evidence':
      core = resolveObtainVisualGroundEvidence(snapshot, used, bundle, conflict, scores, missionNote)
      break
    case 'confirm_recent_activity':
      core = resolveConfirmRecentActivity(snapshot, used, bundle, conflict, scores, missionNote)
      break
    case 'differentiate_possible_non_fire_heat_source':
      core = resolveDifferentiateNonFire(used, bundle, conflict, scores)
      break
    default:
      core = resolveGenericNeed(snapshot.need_type, used, bundle, conflict, scores, missionNote)
  }

  if (snapshot.previous_resolution_status === 'blocked') {
    core.resolution_status = 'blocked'
    core.resolution_reasons.push('Necesidad bloqueada operacionalmente')
  }

  const context_signature = hashResolutionContext({
    need_id: snapshot.need_id,
    need_type: snapshot.need_type,
    evidence: used.map((e) => ({
      submission_id: e.submission_id,
      validation_id: e.validation_id,
      status: e.validation_status,
      coverage: e.valid_coverage_status,
      strength: e.evidence_strength,
    })),
    missions: snapshot.mission_outcomes.map((m) => ({ id: m.mission_id, status: m.status })),
    conflicts: snapshot.conflicts.map((c) => `${c.submission_id_a}:${c.submission_id_b}:${c.conflict_type}`),
    incident_status: snapshot.incident_status,
    model: RESOLUTION_MODEL_VERSION,
  })

  return { ok: true, context_signature, ...core }
}

export function derivePlanResolution(
  planId: string,
  needResults: Array<{ need_id: string; need_type: string; status: NeedResolutionStatus }>,
): PlanResolutionSummary {
  const counts = {
    satisfied: 0,
    partially_satisfied: 0,
    open: 0,
    inconclusive: 0,
    conflicting: 0,
    insufficient: 0,
    blocked: 0,
    other: 0,
  }

  for (const n of needResults) {
    if (n.status === 'satisfied') counts.satisfied += 1
    else if (n.status === 'partially_satisfied') counts.partially_satisfied += 1
    else if (n.status === 'open') counts.open += 1
    else if (n.status === 'inconclusive') counts.inconclusive += 1
    else if (n.status === 'conflicting_evidence') counts.conflicting += 1
    else if (n.status === 'insufficient_evidence') counts.insufficient += 1
    else if (n.status === 'blocked') counts.blocked += 1
    else counts.other += 1
  }

  const reasons: string[] = []
  let derived_status = 'in_progress'

  if (needResults.length === 0) {
    derived_status = 'not_required'
    reasons.push('Plan sin necesidades activas')
  } else if (counts.blocked === needResults.length) {
    derived_status = 'blocked'
    reasons.push('Todas las necesidades bloqueadas')
  } else if (counts.satisfied === needResults.length) {
    derived_status = 'satisfied'
    reasons.push('Todas las necesidades satisfechas')
  } else if (counts.conflicting > 0) {
    derived_status = 'inconclusive'
    reasons.push('Necesidades con conflicto de evidencia material')
  } else if (counts.satisfied > 0 && counts.open + counts.inconclusive + counts.insufficient > 0) {
    derived_status = 'partially_satisfied'
    reasons.push('Mezcla de necesidades satisfechas y pendientes')
  } else if (counts.open > 0 || counts.insufficient > 0) {
    derived_status = 'in_progress'
    reasons.push('Necesidades aún abiertas o con evidencia insuficiente')
  } else if (counts.inconclusive > 0) {
    derived_status = 'inconclusive'
    reasons.push('Necesidades con resultado inconcluso')
  }

  return {
    plan_id: planId,
    derived_status,
    need_resolutions: needResults,
    satisfied_count: counts.satisfied,
    open_count: counts.open + counts.insufficient,
    inconclusive_count: counts.inconclusive,
    conflicting_count: counts.conflicting,
    reasons,
  }
}

export { RESOLUTION_MODEL_VERSION }
