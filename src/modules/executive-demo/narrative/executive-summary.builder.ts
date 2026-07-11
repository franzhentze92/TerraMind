import type {
  ExecutiveDashboardDto,
  ExecutiveSummaryNarrative,
  StageAuditEntry,
} from '../types/executive-demo.types'
import {
  DECISIONS_EMPTY,
  RESPONSE_ASSESSMENTS_EMPTY,
  TENANT_INCIDENTS_EMPTY,
  VALIDATIONS_EMPTY,
  RESOLUTIONS_EMPTY,
} from './empty-states'

export function buildExecutiveSummary(input: {
  fireEvents: number
  findings: number
  incidents: number
  tenantIncidents: number
  missions: number
  evidence: number
  validations: number
  resolutions: number
  assessments: number
  decisions: number
  systemStatus: string
}): ExecutiveSummaryNarrative {
  const happening =
    input.fireEvents > 0
      ? `TerraMind monitorea ${input.fireEvents} evento(s) térmico(s) agrupados y ${input.findings} hallazgo(s) compuestos en el territorio nacional.`
      : 'TerraMind está operativo; no hay eventos térmicos agrupados recientes en la ventana activa.'

  const changed =
    input.findings > 0
      ? `${input.findings} hallazgos compuestos disponibles para revisión; ${input.incidents} incidente(s) correlacionados en base.`
      : 'Sin hallazgos nuevos en el período consultado.'

  const attention =
    input.findings > 0
      ? 'Revisar hallazgos con mayor severidad y eventos con prioridad elevada en el mapa nacional.'
      : 'Mantener monitoreo de fuentes FIRMS y pipelines de enriquecimiento.'

  const verification =
    input.missions > 0
      ? `${input.missions} misión(es) registrada(s); ${input.evidence} envío(s) de evidencia en flujo.`
      : input.incidents > 0
        ? 'Existen incidentes con planes de verificación; misiones de campo pueden activarse desde verificaciones.'
        : 'No hay misiones activas en el período.'

  const recommends =
    input.assessments > 0
      ? `${input.assessments} evaluación(es) de respuesta vigente(s) — revisar recomendaciones en Respuesta operacional.`
      : RESPONSE_ASSESSMENTS_EMPTY.why_empty

  const pending =
    input.decisions > 0
      ? `${input.decisions} decisión(es) humana(s) registrada(s) sobre respuestas.`
      : input.assessments > 0
        ? 'Hay assessments sin decisión humana final.'
        : DECISIONS_EMPTY.why_empty

  return {
    what_is_happening: happening,
    what_changed: changed,
    requires_attention: attention,
    in_verification: verification,
    terramind_recommends: recommends,
    pending_decision: pending,
  }
}

export function buildDataAudit(counts: Record<string, number>): StageAuditEntry[] {
  const tenantIncidents = counts.incidents_tenant ?? 0
  const legacyIncidents = counts.incidents_legacy ?? 0

  return [
    stage('fire_detections', counts.fire_detections, counts.fire_detections > 0 ? 'has_real_data' : 'empty', 'Observaciones FIRMS'),
    stage('fire_events', counts.fire_events, counts.fire_events > 0 ? 'has_real_data' : 'empty', 'Eventos térmicos agrupados'),
    stage('findings', counts.composite_findings, counts.composite_findings > 0 ? 'has_real_data' : 'empty', 'Hallazgos compuestos'),
    stage('priorities', counts.finding_priority_assessments, counts.finding_priority_assessments > 0 ? 'has_real_data' : 'empty', 'Prioridades'),
    stage(
      'incidents',
      counts.incidents_total,
      tenantIncidents > 0 ? 'has_real_data' : legacyIncidents > 0 ? 'legacy_only' : 'empty',
      tenantIncidents > 0 ? 'Incidentes tenant-owned' : 'Solo incidentes legacy sin organization_id',
    ),
    stage('lifecycle', counts.event_lifecycle_transitions, counts.event_lifecycle_transitions > 0 ? 'has_real_data' : 'empty', 'Transiciones lifecycle'),
    stage('verification_plans', counts.verification_plans, counts.verification_plans > 0 ? 'has_real_data' : 'empty', 'Planes de verificación'),
    stage('verification_needs', counts.verification_needs, counts.verification_needs > 0 ? 'has_real_data' : 'empty', 'Necesidades de verificación'),
    stage('missions', counts.missions, counts.missions > 0 ? 'pilot_only' : 'empty', 'Misiones (incluye piloto Field Sync)'),
    stage('evidence', counts.evidence_submissions, counts.evidence_submissions > 0 ? 'pilot_only' : 'empty', 'Evidencia de campo'),
    stage('validations', counts.evidence_validations, counts.evidence_validations > 0 ? 'has_real_data' : 'empty', VALIDATIONS_EMPTY.why_empty),
    stage('resolutions', counts.verification_need_resolutions, counts.verification_need_resolutions > 0 ? 'has_real_data' : 'empty', RESOLUTIONS_EMPTY.why_empty),
    stage('response_assessments', counts.response_assessments, counts.response_assessments > 0 ? 'has_real_data' : 'empty', RESPONSE_ASSESSMENTS_EMPTY.why_empty),
    stage('decisions', counts.decision_records, counts.decision_records > 0 ? 'has_real_data' : 'empty', DECISIONS_EMPTY.why_empty),
    stage('actions', counts.response_actions, counts.response_actions > 0 ? 'has_real_data' : 'empty', 'Acciones de respuesta'),
  ]
}

function stage(
  stageName: string,
  count: number,
  status: StageAuditEntry['status'],
  note: string,
): StageAuditEntry {
  return { stage: stageName, count, status, note }
}

export function collectEmptySections(dashboard: Partial<ExecutiveDashboardDto>) {
  const empty = []
  if ((dashboard.response_recommendations?.length ?? 0) === 0) empty.push(RESPONSE_ASSESSMENTS_EMPTY)
  if ((dashboard.pending_decisions?.length ?? 0) === 0) empty.push(DECISIONS_EMPTY)
  if ((dashboard.recent_resolutions?.length ?? 0) === 0) empty.push(RESOLUTIONS_EMPTY)
  if ((dashboard.recent_evidence?.length ?? 0) === 0 && (dashboard.missions_in_progress?.length ?? 0) === 0) {
    /* missions may exist without evidence listed */
  }
  const tenantIncidents = dashboard.active_incidents?.filter((i) => !i.is_legacy) ?? []
  if (tenantIncidents.length === 0 && (dashboard.active_incidents?.length ?? 0) > 0) {
    empty.push(TENANT_INCIDENTS_EMPTY)
  }
  return empty
}
