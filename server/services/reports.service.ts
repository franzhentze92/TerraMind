import type { ReportClassification, NationalReportDto, IncidentReportDto, ReportPeriod } from '@/modules/executive-demo/types/executive-demo.types'
import { assertSafeExecutivePayload } from '@/modules/executive-demo/copy-guard/executive-copy-guard'
import { DEMO_DISCLAIMER } from '@/modules/executive-demo/demo-config'
import {
  assertNeverAutoVerified,
  resolveNationalReportClassification,
} from '@/modules/executive-demo/narrative/report-classification'
import type { RequestAuthContext } from '@/core/auth/permissions'
import type { ExecutiveMetric } from '@/modules/executive-metrics/executive-metric.types'
import { getExecutiveDashboard } from './executive-dashboard.service.js'
import { getExecutiveMetrics } from './executive-metrics.service.js'
import { getIncidentStory } from './incident-story.service.js'

/**
 * Single projection the national report uses to print any KPI. Reports MUST read
 * from the same canonical metric array the dashboard consumes, so this guarantees
 * dashboard and report never diverge for the same filters. Exercised by
 * executive-metrics.service.test.ts (dashboard == report).
 */
export function reportMetricValue(metrics: ExecutiveMetric[], id: string): number {
  return metrics.find((m) => m.id === id)?.value ?? 0
}

export function parseReportPeriod(
  preset: string | null,
  fromParam: string | null,
  toParam: string | null,
): ReportPeriod {
  const now = new Date()
  const to = toParam ? new Date(toParam) : now
  let from: Date
  let presetKey: ReportPeriod['preset'] = '7d'

  if (preset === '24h') {
    from = new Date(to.getTime() - 24 * 3600_000)
    presetKey = '24h'
  } else if (preset === '30d') {
    from = new Date(to.getTime() - 30 * 24 * 3600_000)
    presetKey = '30d'
  } else if (preset === 'custom' && fromParam) {
    from = new Date(fromParam)
    presetKey = 'custom'
  } else {
    from = new Date(to.getTime() - 7 * 24 * 3600_000)
    presetKey = '7d'
  }

  return { preset: presetKey, from: from.toISOString(), to: to.toISOString() }
}

function classificationLabel(c: ReportClassification): string {
  const map: Record<ReportClassification, string> = {
    internal_use: 'Uso interno',
    draft: 'Borrador',
    verified: 'Verificado',
    internal_demo: 'Demostración interna',
  }
  return map[c]
}

export async function buildNationalReport(
  auth: RequestAuthContext,
  period: ReportPeriod,
  includeDemo: boolean,
): Promise<NationalReportDto> {
  const dashboard = await getExecutiveDashboard(auth, { include_demo: includeDemo })
  const canonicalMetrics = await getExecutiveMetrics(auth, { include_demo: includeDemo })
  const metricValue = (id: string): number => reportMetricValue(canonicalMetrics, id)
  const classification = assertNeverAutoVerified(
    resolveNationalReportClassification(dashboard, includeDemo),
  )

  const report: NationalReportDto = {
    title: 'TerraMind National Environmental Intelligence Report',
    classification,
    period,
    generated_at: new Date().toISOString(),
    dashboard,
    canonical_metrics: canonicalMetrics,
    sections: [
      section('cover', 'Portada', `TerraMind · Guatemala · ${classificationLabel(classification)}`),
      section('executive', 'Resumen ejecutivo', [
        dashboard.summary.what_is_happening,
        dashboard.summary.requires_attention,
        dashboard.summary.terramind_recommends,
      ].join('\n\n')),
      section('sources', 'Estado de fuentes y pipelines', `Estado: ${dashboard.system_status} · Fuentes activas: ${metricValue('sources_active')} · Última sync: ${dashboard.last_sync_at ?? 'n/d'}`),
      section('situation', 'Situación nacional', dashboard.summary.what_changed),
      section('findings', 'Hallazgos prioritarios', `${metricValue('findings_active')} hallazgo(s) activos`),
      section('incidents', 'Incidentes', `${metricValue('incidents_operational')} incidente(s) operacional(es)`),
      section('changes', 'Cambios en el período', `${dashboard.recent_changes.length} evento(s) recientes`),
      section('verification', 'Verificaciones', `${metricValue('verification_plans_legacy')} plan(es) legacy · ${metricValue('verification_needs_active')} necesidad(es) activa(s)`),
      section('missions', 'Misiones', `${metricValue('missions_operational')} misión(es) operacional(es)`),
      section('evidence', 'Evidencia y validación', `${metricValue('evidence_operational')} envío(s) operacional(es)`),
      section('resolutions', 'Resoluciones', dashboard.recent_resolutions.length > 0 ? 'Ver resoluciones activas' : 'Sin resoluciones completadas'),
      section('responses', 'Respuestas recomendadas', metricValue('response_assessments') > 0 ? `${metricValue('response_assessments')} evaluación(es) de respuesta` : 'Sin evaluaciones de respuesta — se generan tras una resolución de verificación'),
      section('decisions', 'Decisiones pendientes', dashboard.pending_decisions.length > 0 ? `${dashboard.pending_decisions.length} pendiente(s)` : 'Sin decisiones'),
      section('uncertainties', 'Incertidumbres', 'Los niveles de confianza se reportan por etapa; no se confirman causas ni daños.'),
      section('next', 'Próximas acciones', dashboard.summary.pending_decision),
      section('sources_list', 'Fuentes', 'NASA FIRMS, motores TerraMind, evidencia de campo'),
      section('methodology', 'Metodología', 'Agregación determinística de motores 8A–8C.1 sin LLM generativo.'),
      section('limitations', 'Limitaciones', includeDemo ? DEMO_DISCLAIMER : 'Datos legacy sin ownership no generan assessments de respuesta.'),
    ],
  }

  assertSafeExecutivePayload(report)
  return report
}

export async function buildIncidentReport(
  auth: RequestAuthContext,
  incidentId: string,
  includeDemo: boolean,
): Promise<IncidentReportDto | null> {
  const story = await getIncidentStory(incidentId, { include_demo: includeDemo })
  if (!story) return null

  const report: IncidentReportDto = {
    title: `Informe de incidente · ${incidentId.slice(0, 8)}…`,
    classification: story.classification,
    incident_id: incidentId,
    generated_at: new Date().toISOString(),
    story,
    sections: story.stages.map((s) =>
      section(s.key, s.title, s.summary + (s.detail ? `\n\n${s.detail}` : '')),
    ),
  }

  assertSafeExecutivePayload(report)
  return report
}

function section(id: string, title: string, content: string) {
  return { id, title, content }
}
