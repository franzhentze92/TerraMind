import type { ReportClassification, NationalReportDto, IncidentReportDto, ReportPeriod } from '@/modules/executive-demo/types/executive-demo.types'
import { assertSafeExecutivePayload } from '@/modules/executive-demo/copy-guard/executive-copy-guard'
import { DEMO_DISCLAIMER } from '@/modules/executive-demo/demo-config'
import {
  assertNeverAutoVerified,
  resolveNationalReportClassification,
} from '@/modules/executive-demo/narrative/report-classification'
import type { RequestAuthContext } from '@/core/auth/permissions'
import { getExecutiveDashboard } from './executive-dashboard.service.js'
import { getIncidentStory } from './incident-story.service.js'

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
  const classification = assertNeverAutoVerified(
    resolveNationalReportClassification(dashboard, includeDemo),
  )

  const report: NationalReportDto = {
    title: 'TerraMind National Environmental Intelligence Report',
    classification,
    period,
    generated_at: new Date().toISOString(),
    dashboard,
    sections: [
      section('cover', 'Portada', `TerraMind · Guatemala · ${classificationLabel(classification)}`),
      section('executive', 'Resumen ejecutivo', [
        dashboard.summary.what_is_happening,
        dashboard.summary.requires_attention,
        dashboard.summary.terramind_recommends,
      ].join('\n\n')),
      section('sources', 'Estado de fuentes y pipelines', `Estado: ${dashboard.system_status} · Fuentes activas: ${dashboard.sources_active} · Última sync: ${dashboard.last_sync_at ?? 'n/d'}`),
      section('situation', 'Situación nacional', dashboard.summary.what_changed),
      section('findings', 'Hallazgos prioritarios', `${dashboard.priority_findings.length} hallazgo(s) destacados`),
      section('incidents', 'Incidentes', `${dashboard.active_incidents.length} incidente(s) en vista`),
      section('changes', 'Cambios en el período', `${dashboard.recent_changes.length} evento(s) recientes`),
      section('verification', 'Verificaciones', `${dashboard.pending_verifications.length} plan(es)`),
      section('missions', 'Misiones', `${dashboard.missions_in_progress.length} misión(es)`),
      section('evidence', 'Evidencia y validación', `${dashboard.recent_evidence.length} envío(s) recientes`),
      section('resolutions', 'Resoluciones', dashboard.recent_resolutions.length > 0 ? 'Ver resoluciones activas' : 'Sin resoluciones completadas'),
      section('responses', 'Respuestas recomendadas', dashboard.response_recommendations.length > 0 ? `${dashboard.response_recommendations.length} assessment(s)` : 'Sin assessments — ver empty state'),
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
