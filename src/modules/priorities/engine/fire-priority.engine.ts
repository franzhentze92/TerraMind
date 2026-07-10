import type { CompositeFinding } from '@/modules/findings/findings.types'
import {
  ACTION_CAP_UNCONFIRMED_FIRE,
  ACTION_THRESHOLDS,
  ATTENTION_THRESHOLDS,
  CONFIDENCE_MODIFIERS,
  DOMAIN_CAPS,
  EVENT_STATUS_URGENCY,
  FINDING_WEIGHTS,
  FIRE_PRIORITY_FINDINGS_RULE_SET,
  FIRE_PRIORITY_MODEL_VERSION,
  FIRE_PRIORITY_VALIDITY_HOURS,
  PERSISTENCE_BONUS,
  SUBSTITUTION_RULES,
  THERMAL_DECAY_CONFIG,
  VERIFICATION_THRESHOLDS,
} from '@/modules/priorities/config/fire-priority.config'
import { assertSafePriorityCopy } from '@/modules/priorities/priorities-copy-guard'
import type {
  ActionLevel,
  AttentionLevel,
  DomainContributionSummary,
  EvidenceContributionState,
  FindingContributionRecord,
  FindingSnapshotEntry,
  FirePriorityEventContext,
  PriorityAssessment,
  PriorityEvaluationInput,
  PriorityEvaluationResult,
  PriorityLevelChange,
  PriorityScoreDelta,
  ScoreExplanation,
  VerificationLevel,
} from '@/modules/priorities/priorities.types'
import type { FireFindingType } from '@/modules/findings/findings.types'

function clamp(score: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, Math.round(score * 100) / 100))
}

function resolveLevel<T extends string>(
  score: number,
  thresholds: Record<T, number>,
  ordered: T[],
): T {
  let level = ordered[0]
  for (const candidate of ordered) {
    if (score >= thresholds[candidate]) level = candidate
  }
  return level
}

function hoursSince(iso: string, now: Date): number {
  return Math.max(0, (now.getTime() - new Date(iso).getTime()) / 3_600_000)
}

function confidenceModifier(level: string): number {
  return CONFIDENCE_MODIFIERS[level] ?? CONFIDENCE_MODIFIERS.insufficient
}

function sortFindingsDeterministic(findings: CompositeFinding[]): CompositeFinding[] {
  return [...findings].sort((a, b) => {
    const typeCmp = a.finding_type.localeCompare(b.finding_type)
    if (typeCmp !== 0) return typeCmp
    return (a.id ?? '').localeCompare(b.id ?? '')
  })
}

function applySubstitution(
  findings: CompositeFinding[],
): {
  active: CompositeFinding[]
  subsumed: Array<{ finding: CompositeFinding; dominant: string }>
} {
  const byType = new Map(findings.map((f) => [f.finding_type, f]))
  const subsumedTypes = new Set<string>()
  const subsumed: Array<{ finding: CompositeFinding; dominant: string }> = []

  for (const rule of SUBSTITUTION_RULES) {
    if (byType.has(rule.dominant) && byType.has(rule.subsumed)) {
      subsumedTypes.add(rule.subsumed)
      subsumed.push({ finding: byType.get(rule.subsumed)!, dominant: rule.dominant })
    }
  }

  return {
    active: findings.filter((f) => !subsumedTypes.has(f.finding_type)),
    subsumed,
  }
}

function mapFindingContribution(
  finding: CompositeFinding,
  state: EvidenceContributionState,
): FindingContributionRecord {
  const weights = FINDING_WEIGHTS[finding.finding_type as FireFindingType]
  const domain = (weights?.domain ?? 'composite') as FindingContributionRecord['domain']
  const raw =
    (weights?.severity ?? 0) +
    (weights?.urgency ?? 0) +
    (weights?.exposure ?? 0) +
    (weights?.sensitivity ?? 0) +
    (weights?.verification ?? 0)

  return {
    finding_id: finding.id ?? finding.finding_type,
    finding_type: finding.finding_type,
    rule_code: finding.triggered_rules[0] ?? finding.finding_type,
    domain,
    state,
    raw_contribution: raw,
    accepted_contribution: state === 'supporting_evidence' ? raw : 0,
    dimensions: {
      severity: weights?.severity ?? 0,
      urgency: weights?.urgency ?? 0,
      exposure: weights?.exposure ?? 0,
      sensitivity: weights?.sensitivity ?? 0,
      persistence: 0,
      verification: weights?.verification ?? 0,
    },
  }
}

function applyDomainCaps(
  records: FindingContributionRecord[],
): {
  summaries: DomainContributionSummary[]
  dimensionTotals: ScoreExplanation['dimension_base']
  verificationRaw: number
} {
  const byDomain = new Map<string, FindingContributionRecord[]>()
  for (const record of records) {
    if (record.state !== 'supporting_evidence') continue
    const list = byDomain.get(record.domain) ?? []
    list.push(record)
    byDomain.set(record.domain, list)
  }

  const summaries: DomainContributionSummary[] = []
  const dimensionTotals = {
    severity: 0,
    urgency: 0,
    exposure: 0,
    sensitivity: 0,
    persistence: 0,
  }
  let verificationRaw = 0

  for (const [domain, domainRecords] of byDomain.entries()) {
    const cap = DOMAIN_CAPS[domain] ?? 20
    const rawTotal = domainRecords.reduce((s, r) => s + r.raw_contribution, 0)
    let accepted = 0
    let remaining = cap

    for (const record of domainRecords) {
      const share = Math.min(remaining, record.raw_contribution)
      record.accepted_contribution = share
      accepted += share
      remaining -= share
      dimensionTotals.severity += Math.min(share, record.dimensions.severity)
      dimensionTotals.urgency += Math.min(share, record.dimensions.urgency)
      dimensionTotals.exposure += Math.min(share, record.dimensions.exposure)
      dimensionTotals.sensitivity += Math.min(share, record.dimensions.sensitivity)
      verificationRaw += record.dimensions.verification
    }

    summaries.push({
      domain: domain as DomainContributionSummary['domain'],
      raw_total: rawTotal,
      accepted_total: accepted,
      cap,
      capped_amount: Math.max(0, rawTotal - accepted),
      findings: domainRecords.map((r) => r.finding_type),
    })
  }

  return { summaries, dimensionTotals, verificationRaw }
}

function computeConcurrencyBonus(
  domainSummaries: DomainContributionSummary[],
  multiContextFinding: CompositeFinding | undefined,
): ScoreExplanation['concurrency_bonus'] {
  const contributingDomains = domainSummaries.filter(
    (s) => s.domain !== 'composite' && s.accepted_total > 0,
  )
  const domainCount = contributingDomains.length

  if (!multiContextFinding || domainCount < 3) {
    return {
      applied: false,
      raw_bonus: 0,
      accepted_bonus: 0,
      cap: DOMAIN_CAPS.composite,
      explanation:
        domainCount < 3
          ? 'Concurrencia insuficiente para bonus compuesto'
          : 'Hallazgo multi_context no activo',
    }
  }

  const rawBonus = FINDING_WEIGHTS.multi_context_attention.concurrency_bonus ?? 8
  const accepted = Math.min(DOMAIN_CAPS.composite, rawBonus)

  return {
    applied: true,
    raw_bonus: rawBonus,
    accepted_bonus: accepted,
    cap: DOMAIN_CAPS.composite,
    explanation:
      'Bonus de concurrencia por múltiples dominios activos; no re-suma evidencia ya contabilizada',
  }
}

function computeDecay(event: FirePriorityEventContext, now: Date): ScoreExplanation['decay'] {
  const hours = hoursSince(event.last_detected_at, now)
  const decayPoints = Math.min(
    THERMAL_DECAY_CONFIG.max_decay_points,
    (hours / THERMAL_DECAY_CONFIG.half_life_hours) * (THERMAL_DECAY_CONFIG.max_decay_points / 2),
  )
  return {
    applied: decayPoints > 0,
    hours_since_last_detection: Math.round(hours * 10) / 10,
    decay_points: Math.round(decayPoints * 100) / 100,
    profile: THERMAL_DECAY_CONFIG.profile,
  }
}

function computePersistence(event: FirePriorityEventContext): number {
  const hoursBonus = Math.min(
    PERSISTENCE_BONUS.max,
    (event.persistence_hours ?? 0) * PERSISTENCE_BONUS.per_hour,
  )
  const detectionBonus = Math.min(
    PERSISTENCE_BONUS.detection_max,
    Math.max(0, event.detection_count - 1) * PERSISTENCE_BONUS.per_detection,
  )
  return Math.min(DOMAIN_CAPS.persistence, hoursBonus + detectionBonus)
}

function buildComponentEvidenceStates(
  event: FirePriorityEventContext,
): ScoreExplanation['component_evidence_states'] {
  const states: ScoreExplanation['component_evidence_states'] = []
  const labels: Record<string, string> = {
    protected_area: 'Área protegida',
    land_cover: 'Cobertura del suelo',
    population: 'Población',
    climate: 'Clima',
    biodiversity: 'Biodiversidad',
  }

  for (const [key, label] of Object.entries(labels)) {
    const availability = event.context_availability[key as keyof typeof event.context_availability]
    let state: EvidenceContributionState = 'not_applicable'
    let note = ''
    if (availability === 'missing') {
      state = 'missing_context'
      note = `${label}: contexto no disponible; no se interpreta como condición favorable`
    } else if (availability === 'partial' || availability === 'unavailable') {
      state = 'uncertain_context'
      note = `${label}: contexto parcial o limitado`
    } else if (availability === 'complete') {
      state = 'supporting_evidence'
      note = `${label}: contexto disponible`
    }
    states.push({ component: key, state, note })
  }

  return states
}

function buildPriorityReasons(
  dimensionTotals: ScoreExplanation['dimension_base'],
  domainSummaries: DomainContributionSummary[],
  concurrency: ScoreExplanation['concurrency_bonus'],
  event: FirePriorityEventContext,
): string[] {
  const reasons: string[] = []
  const topDomains = [...domainSummaries]
    .filter((d) => d.accepted_total > 0)
    .sort((a, b) => b.accepted_total - a.accepted_total)

  if (topDomains.some((d) => d.domain === 'protected_areas')) {
    reasons.push('Actividad térmica relacionada con área protegida')
  }
  if (topDomains.some((d) => d.domain === 'land_cover')) {
    reasons.push('Detecciones sobre cobertura natural o forestal')
  }
  if (dimensionTotals.urgency >= 8) {
    reasons.push('Urgencia temporal elevada por recencia o condiciones meteorológicas')
  }
  if (concurrency.applied) {
    reasons.push('Múltiples contextos ambientales concurrentes')
  }
  if (event.status === 'active') {
    reasons.push('Evento con actividad reciente')
  }
  return reasons.slice(0, 6)
}

function buildLimitations(
  event: FirePriorityEventContext,
  findings: CompositeFinding[],
): string[] {
  const limitations = [
    'La detección térmica no confirma un incendio.',
    'La prioridad representa necesidad de revisión, no afectación comprobada.',
  ]

  for (const [key, label] of Object.entries({
    land_cover: 'Cobertura del suelo',
    population: 'Población',
    climate: 'Clima',
    biodiversity: 'Biodiversidad',
  })) {
    const availability = event.context_availability[key as keyof typeof event.context_availability]
    if (availability === 'missing') {
      limitations.push(`${label}: contexto no disponible durante esta evaluación`)
    }
  }

  const popUncertainty = findings.some(
    (f) => f.finding_type === 'nearby_population_with_high_uncertainty',
  )
  if (popUncertainty) {
    limitations.push('Los modelos de población presentan alta divergencia local')
  }

  const bioLimited = findings.some((f) => f.finding_type === 'biodiversity_context_limited')
  if (bioLimited) {
    limitations.push('El contexto de biodiversidad presenta limitaciones de cobertura o proveedor')
  }

  return [...new Set(limitations)]
}

function buildRecommendedNextStep(
  attention: AttentionLevel,
  verification: VerificationLevel,
  action: ActionLevel,
): string {
  if (verification === 'high_priority') {
    return 'Revisar últimas detecciones y solicitar verificación prioritaria'
  }
  if (attention === 'priority_attention' || attention === 'high_attention') {
    return 'Revisar evolución de nuevas detecciones y coordinar seguimiento'
  }
  if (action === 'coordinate' || action === 'operational_attention') {
    return 'Preparar coordinación con autoridad territorial competente'
  }
  if (verification === 'recommended') {
    return 'Obtener evidencia adicional antes de ampliar la respuesta'
  }
  if (attention === 'review') {
    return 'Mantener seguimiento y revisar en la próxima ventana de evaluación'
  }
  return 'Mantener observación rutinaria'
}

function compareLevels<T extends string>(
  prev: T | undefined,
  next: T,
): { from: T; to: T } | undefined {
  if (!prev || prev === next) return undefined
  return { from: prev, to: next }
}

function buildChangeReasons(
  prev: PriorityAssessment | null | undefined,
  next: PriorityAssessment,
): string[] {
  if (!prev) return ['Primera evaluación de prioridad para esta entidad']
  const reasons: string[] = []
  if (next.score_delta.attention_delta > 5) reasons.push('Aumentó la necesidad de atención')
  if (next.score_delta.attention_delta < -5) reasons.push('Disminuyó la necesidad de atención')
  if (next.score_delta.verification_delta > 5) reasons.push('Aumentó la necesidad de verificación')
  if (next.level_change.attention) {
    reasons.push(
      `Nivel de atención: ${prev.attention_level} → ${next.attention_level}`,
    )
  }
  if (next.level_change.verification) {
    reasons.push(
      `Nivel de verificación: ${prev.verification_level} → ${next.verification_level}`,
    )
  }
  return reasons.length ? reasons : ['Evaluación actualizada sin cambio material de niveles']
}

export function evaluateFireEventPriority(
  input: PriorityEvaluationInput,
): PriorityEvaluationResult {
  const started = Date.now()
  const now = new Date(input.evaluated_at)
  const warnings: string[] = []

  const sorted = sortFindingsDeterministic(
    input.findings.filter((f) => f.status === 'active' || f.status === 'monitoring'),
  )

  const { active, subsumed } = applySubstitution(sorted)
  const records: FindingContributionRecord[] = []
  const discarded: ScoreExplanation['discarded_by_redundancy'] = []

  for (const { finding, dominant } of subsumed) {
    const mapped = mapFindingContribution(finding, 'not_applicable')
    mapped.discard_reason = `Sustituido por hallazgo dominante: ${dominant}`
    mapped.accepted_contribution = 0
    records.push(mapped)
    discarded.push({
      finding_type: finding.finding_type,
      reason: mapped.discard_reason,
      would_have_contributed: mapped.raw_contribution,
    })
  }

  const multiContext = active.find((f) => f.finding_type === 'multi_context_attention')
  const domainFindings = active.filter((f) => f.finding_type !== 'multi_context_attention')

  for (const finding of domainFindings) {
    const modifier = confidenceModifier(finding.confidence.level)
    const mapped = mapFindingContribution(finding, 'supporting_evidence')
    mapped.raw_contribution = Math.round(mapped.raw_contribution * modifier * 100) / 100
    mapped.dimensions.severity = Math.round(mapped.dimensions.severity * modifier * 100) / 100
    mapped.dimensions.urgency = Math.round(mapped.dimensions.urgency * modifier * 100) / 100
    mapped.dimensions.exposure = Math.round(mapped.dimensions.exposure * modifier * 100) / 100
    mapped.dimensions.sensitivity =
      Math.round(mapped.dimensions.sensitivity * modifier * 100) / 100
    mapped.dimensions.verification =
      Math.round(mapped.dimensions.verification * modifier * 100) / 100
    records.push(mapped)
  }

  if (multiContext) {
    const mapped = mapFindingContribution(multiContext, 'supporting_evidence')
    mapped.raw_contribution = 0
    mapped.accepted_contribution = 0
    mapped.discard_reason =
      'Hallazgo derivado; aporta bonus de concurrencia, no contribución de dominio adicional'
    records.push(mapped)
  }

  const { summaries, dimensionTotals, verificationRaw } = applyDomainCaps(records)
  const concurrency = computeConcurrencyBonus(summaries, multiContext)
  const decay = computeDecay(input.event, now)
  const persistence = computePersistence(input.event)
  dimensionTotals.persistence = persistence

  const statusUrgency = EVENT_STATUS_URGENCY[input.event.status] ?? 0
  dimensionTotals.urgency += statusUrgency

  const rawBase =
    dimensionTotals.severity +
    dimensionTotals.urgency +
    dimensionTotals.exposure +
    dimensionTotals.sensitivity +
    dimensionTotals.persistence +
    concurrency.accepted_bonus

  const adjustedBase = Math.max(0, rawBase - decay.decay_points)

  const avgConfidence =
    domainFindings.length > 0
      ? domainFindings.reduce((s, f) => s + confidenceModifier(f.confidence.level), 0) /
        domainFindings.length
      : CONFIDENCE_MODIFIERS.insufficient

  const uncertaintyBoost =
    verificationRaw +
    (input.event.context_availability.population !== 'complete' ? 4 : 0) +
    (input.event.context_availability.biodiversity === 'partial' ? 4 : 0) +
    (input.event.context_availability.climate === 'partial' ? 3 : 0)

  const evidenceReliability = avgConfidence
  const uncertaintyModifier = 1 + (1 - avgConfidence) * 0.35

  let attentionScore = clamp(adjustedBase * evidenceReliability + concurrency.accepted_bonus * 0.5)
  let verificationScore = clamp(uncertaintyBoost * uncertaintyModifier)
  let actionScore = clamp(attentionScore * 0.85)

  const actionCap =
    input.event.validation_status !== 'confirmado' ? ACTION_CAP_UNCONFIRMED_FIRE : 100
  if (actionScore > actionCap) {
    actionScore = actionCap
  }

  if (rawBase > 40 && avgConfidence < 0.8) {
    verificationScore = clamp(Math.max(verificationScore, attentionScore * 0.9))
  }

  const attentionLevel = resolveLevel(attentionScore, ATTENTION_THRESHOLDS, [
    'routine',
    'monitor',
    'review',
    'high_attention',
    'priority_attention',
  ])
  const verificationLevel = resolveLevel(verificationScore, VERIFICATION_THRESHOLDS, [
    'not_required',
    'useful',
    'recommended',
    'high_priority',
  ])
  const actionLevel = resolveLevel(actionScore, ACTION_THRESHOLDS, [
    'none',
    'prepare',
    'coordinate',
    'operational_attention',
  ])

  const domainContributions: Record<string, number> = {}
  for (const summary of summaries) {
    domainContributions[summary.domain] = summary.accepted_total
  }
  if (concurrency.accepted_bonus > 0) {
    domainContributions.composite = concurrency.accepted_bonus
  }
  if (persistence > 0) {
    domainContributions.persistence = persistence
  }

  const scoreExplanation: ScoreExplanation = {
    dimension_base: dimensionTotals,
    domain_contributions: summaries,
    discarded_by_redundancy: discarded,
    dominance_substitution_applied: subsumed.map((s) => ({
      dominant: s.dominant,
      subsumed: s.finding.finding_type,
    })),
    concurrency_bonus: concurrency,
    decay,
    confidence_modifiers: {
      evidence_reliability_modifier: Math.round(evidenceReliability * 1000) / 1000,
      uncertainty_modifier: Math.round(uncertaintyModifier * 1000) / 1000,
      action_cap: actionCap,
      reasons: [
        `Confianza media de hallazgos: ${Math.round(avgConfidence * 100)}%`,
        input.event.validation_status !== 'confirmado'
          ? 'Evento no confirmado limita prioridad de acción'
          : 'Evento con validación confirmada',
      ],
    },
    component_evidence_states: buildComponentEvidenceStates(input.event),
    raw_base_priority: Math.round(rawBase * 100) / 100,
    adjusted_base_priority: Math.round(adjustedBase * 100) / 100,
    attention_score_final: attentionScore,
    verification_score_final: verificationScore,
    action_score_final: actionScore,
  }

  const priorityReasons = buildPriorityReasons(
    dimensionTotals,
    summaries,
    concurrency,
    input.event,
  )
  const priorityLimitations = buildLimitations(input.event, sorted)
  const recommendedNextStep = buildRecommendedNextStep(
    attentionLevel,
    verificationLevel,
    actionLevel,
  )

  for (const text of [...priorityReasons, recommendedNextStep, ...priorityLimitations]) {
    assertSafePriorityCopy(text)
  }

  const findingSnapshot: FindingSnapshotEntry[] = sorted.map((f) => {
    const record = records.find((r) => r.finding_type === f.finding_type)
    return {
      finding_id: f.id ?? f.finding_type,
      finding_type: f.finding_type,
      title: f.title,
      severity_label: f.severity_label,
      confidence_level: f.confidence.level,
      contributed: (record?.accepted_contribution ?? 0) > 0 || f.finding_type === 'multi_context_attention',
      contribution_state: record?.state ?? 'not_applicable',
      accepted_contribution: record?.accepted_contribution ?? 0,
      discard_reason: record?.discard_reason,
    }
  })

  const validUntil = new Date(
    now.getTime() + FIRE_PRIORITY_VALIDITY_HOURS * 3_600_000,
  ).toISOString()

  const prev = input.previous_assessment
  const scoreDelta: PriorityScoreDelta = {
    attention_delta: prev ? attentionScore - prev.attention_score : 0,
    verification_delta: prev ? verificationScore - prev.verification_score : 0,
    action_delta: prev ? actionScore - prev.action_score : 0,
  }
  const levelChange: PriorityLevelChange = {
    attention: compareLevels(prev?.attention_level, attentionLevel),
    verification: compareLevels(prev?.verification_level, verificationLevel),
    action: compareLevels(prev?.action_level, actionLevel),
  }

  const assessment: PriorityAssessment = {
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    assessment_status: 'active',
    attention_score: attentionScore,
    action_score: actionScore,
    verification_score: verificationScore,
    attention_level: attentionLevel,
    action_level: actionLevel,
    verification_level: verificationLevel,
    severity_component: dimensionTotals.severity,
    urgency_component: dimensionTotals.urgency,
    exposure_component: dimensionTotals.exposure,
    sensitivity_component: dimensionTotals.sensitivity,
    confidence_component: Math.round((1 - avgConfidence) * 100),
    persistence_component: persistence,
    domain_contributions: domainContributions,
    score_explanation: scoreExplanation,
    priority_reasons: priorityReasons,
    priority_limitations: priorityLimitations,
    recommended_next_step: recommendedNextStep,
    finding_snapshot: findingSnapshot,
    context_version: input.event.context_version,
    rule_set_version: FIRE_PRIORITY_FINDINGS_RULE_SET,
    priority_model_version: FIRE_PRIORITY_MODEL_VERSION,
    previous_assessment_id: prev?.id ?? null,
    score_delta: scoreDelta,
    level_change: levelChange,
    change_reasons: [],
    evaluated_at: input.evaluated_at,
    valid_until: validUntil,
  }

  assessment.change_reasons = buildChangeReasons(prev, assessment)

  if (sorted.length === 0) {
    warnings.push('no_active_findings')
  }

  return {
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    assessment,
    findings_count: sorted.length,
    assessment_created: 0,
    assessment_updated: 0,
    assessment_superseded: 0,
    warnings,
    duration_ms: Date.now() - started,
  }
}

export const firePriorityEngine = {
  evaluateFireEventPriority,
  modelVersion: FIRE_PRIORITY_MODEL_VERSION,
  findingsRuleSetVersion: FIRE_PRIORITY_FINDINGS_RULE_SET,
}
