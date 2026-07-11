import type { NationalReportDto } from '@/modules/executive-demo/types/executive-demo.types'
import type { ExecutiveMetric } from '@/modules/executive-metrics/executive-metric.types'
import { DEMO_DISCLAIMER } from '@/modules/executive-demo/demo-config'
import { buildIncidentDisplayName } from '@/modules/incidents/utils/incident-display-name'
import type { InstitutionalReport, ReportFinding, ReportIncident, ReportTimelineRow } from '../institutional-report.types'
import { executiveMetricToReportMetric } from '../institutional-report.types'
import {
  classificationBanner,
  resolveInstitutionalClassification,
} from '../report-classification'
import { formatReportGeneratedAt, reportPeriodMeta } from '../report-period'
import { REPORT_THEME } from '../report-theme'

const NATIONAL_KPI_IDS = [
  'fire_observations',
  'fire_detections_national',
  'fire_events',
  'findings_active',
  'incidents_operational',
  'pending_decisions',
] as const

function metricValue(metrics: ExecutiveMetric[], id: string): number {
  return metrics.find((m) => m.id === id)?.value ?? 0
}

function epistemicLabel(kind: string): ReportTimelineRow['epistemic'] {
  const map: Record<string, ReportTimelineRow['epistemic']> = {
    observed: 'Observado',
    inferred: 'Inferido',
    verified: 'Verificado',
    recommended: 'Recomendado',
    decided: 'Decidido',
    executed: 'Ejecutado',
    undetermined: 'Inferido',
  }
  return map[kind] ?? 'Observado'
}

export function buildNationalInstitutionalReport(
  report: NationalReportDto,
  includeDemo: boolean,
  organization?: string,
): InstitutionalReport {
  const dashboard = report.dashboard
  const metrics = report.canonical_metrics ?? []
  const recommends = dashboard.summary.terramind_recommends.toLowerCase()
  const claimsFormalRecommendation =
    recommends.includes('recomienda') && !recommends.includes('aún no existe')
  const hasFormalAssessment = dashboard.response_recommendations.length > 0

  const classification = resolveInstitutionalClassification(report.classification, includeDemo, {
    hasLegacyAsOperational: false,
    hasPeriod: Boolean(report.period.from && report.period.to),
    hasSources: true,
    hasMethodology: true,
    hasIncompleteCriticalSections: dashboard.data_audit.some((a) => a.status === 'empty'),
    hasAssessmentWhenRecommending: !claimsFormalRecommendation || hasFormalAssessment,
  })

  const operationalIncidents: ReportIncident[] = dashboard.active_incidents
    .filter((i) => !i.is_legacy && !i.is_internal_demo)
    .slice(0, 20)
    .map((i) => ({
      id: i.id,
      name: buildIncidentDisplayName({ status: i.status, event_count: i.event_count }),
      location: 'Ver detalle en plataforma',
      lifecycle: i.status,
      priority: i.attention_level,
      eventCount: i.event_count,
      verificationStatus: i.story_coverage,
      nextStep: 'Revisar verificación en detalle del incidente',
      classification: 'operational' as const,
    }))

  const legacyIncidents: ReportIncident[] = dashboard.active_incidents
    .filter((i) => i.is_legacy)
    .map((i) => ({
      id: i.id,
      name: buildIncidentDisplayName({ status: i.status, event_count: i.event_count }),
      location: 'Ownership pendiente',
      lifecycle: i.status,
      priority: i.attention_level,
      eventCount: i.event_count,
      verificationStatus: i.story_coverage,
      nextStep: 'Asignar organización',
      classification: 'legacy' as const,
    }))

  const demoIncidents: ReportIncident[] = dashboard.active_incidents
    .filter((i) => i.is_internal_demo)
    .map((i) => ({
      id: i.id,
      name: buildIncidentDisplayName({ status: i.status, event_count: i.event_count }),
      location: 'Demostración interna',
      lifecycle: i.status,
      priority: i.attention_level,
      eventCount: i.event_count,
      verificationStatus: i.story_coverage,
      nextStep: 'No operacional',
      classification: 'demo' as const,
    }))

  const findings: ReportFinding[] = dashboard.priority_findings.slice(0, 5).map((f) => ({
    id: f.id,
    title: f.title,
    location: f.department_name ?? 'Sin departamento',
    category: 'Hallazgo compuesto',
    severity: f.severity_label,
    confidence: 'Ver detalle',
    generatedAt: report.generated_at,
    source: 'Motores TerraMind',
    status: 'activo',
    relevance: 'Priorizado en ventana nacional',
    incidentLink: f.href,
    limitations: ['Actividad térmica no confirma incendio por sí sola'],
  }))

  const executiveSummary = {
    id: 'executive-summary',
    title: 'Resumen ejecutivo',
    content: [
      `## Estado general\n${dashboard.summary.what_is_happening}`,
      `## Cambios relevantes\n${dashboard.summary.what_changed || 'Sin cambios significativos registrados en el periodo.'}`,
      `## Principales prioridades\n${findings.length > 0 ? findings.map((f) => f.title).join(' · ') : 'Sin hallazgos prioritarios en la ventana.'}`,
      `## Estado de verificación\n${dashboard.summary.in_verification}`,
      `## Estado operacional\nMisiones: ${metricValue(metrics, 'missions_operational')} · Evidencia: ${metricValue(metrics, 'evidence_operational')} · Evaluaciones de respuesta: ${metricValue(metrics, 'response_assessments')}`,
      `## Próximo paso\n${hasFormalAssessment ? dashboard.summary.pending_decision : 'Aún no existe una evaluación formal de respuesta para este periodo.'}`,
    ].join('\n\n'),
    status: 'available' as const,
  }

  const timeline: ReportTimelineRow[] = dashboard.recent_changes.slice(0, 15).map((e) => ({
    date: e.timestamp,
    stage: e.stage_label,
    event: e.summary,
    epistemic: epistemicLabel(e.epistemic),
    source: e.source,
    actor: 'Sistema',
    reference: e.stage,
  }))

  const limitations = [
    'La actividad térmica satelital no confirma incendio ni daño por sí sola.',
    'Las observaciones pueden verse afectadas por nubosidad y cobertura de sensores.',
    'Los incidentes legacy no tienen ownership organizacional completo.',
    includeDemo
      ? DEMO_DISCLAIMER
      : 'Los datos de demostración interna están excluidos de resultados operacionales.',
    'Algunas métricas representan estado actual y otras el periodo seleccionado.',
    'La ausencia de evidencia no demuestra ausencia del fenómeno.',
  ]

  const institutional: InstitutionalReport = {
    id: `national-${report.period.from.slice(0, 10)}-${report.period.to.slice(0, 10)}`,
    type: 'national',
    title: 'Informe Nacional de Inteligencia Ambiental',
    subtitle: REPORT_THEME.brandSubtitle,
    classification,
    classificationLabel: classificationBanner(classification),
    status: 'ready',
    period: reportPeriodMeta(report.period),
    territory: { label: 'Guatemala', scope: 'national' },
    generatedAt: report.generated_at,
    organization,
    documentVersion: REPORT_THEME.documentVersion,
    executiveSummary,
    metrics: metrics
      .filter((m) => (NATIONAL_KPI_IDS as readonly string[]).includes(m.id))
      .map(executiveMetricToReportMetric),
    maps: [
      {
        id: 'national-map',
        title: 'Mapa de actividad y prioridades',
        territoryLabel: 'Guatemala',
        periodLabel: reportPeriodMeta(report.period).label,
        source: 'Datos canónicos TerraMind',
        legend: ['Eventos térmicos', 'Prioridades', 'Incidentes operacionales'],
        available: false,
        errorMessage:
          'El mapa estático no pudo renderizarse en esta generación. Consulte la tabla de incidentes.',
        fallbackRows: operationalIncidents.slice(0, 8).map((i) => ({
          label: i.name,
          detail: `${i.lifecycle} · ${i.eventCount} evento(s)`,
        })),
      },
    ],
    findings,
    incidents: operationalIncidents,
    legacyIncidents,
    demoIncidents: includeDemo ? demoIncidents : [],
    verification: {
      activeNeeds: metricValue(metrics, 'verification_needs_active'),
      legacyPlans: metricValue(metrics, 'verification_plans_legacy'),
      missionsRecommended: metricValue(metrics, 'missions_operational'),
      remoteSufficient: metricValue(metrics, 'verification_needs_active') === 0,
      summary: dashboard.summary.in_verification,
    },
    operations: {
      missionsOperational: metricValue(metrics, 'missions_operational'),
      missionsDemo: metricValue(metrics, 'missions_demo'),
      evidenceOperational: metricValue(metrics, 'evidence_operational'),
      resolutionsCount: dashboard.recent_resolutions.length,
      responseAssessments: metricValue(metrics, 'response_assessments'),
      pendingDecisions: metricValue(metrics, 'pending_decisions'),
      summary: dashboard.summary.requires_attention,
    },
    timeline,
    sections: report.sections.map((s) => ({
      id: s.id,
      title: s.title,
      content: s.content,
      status: 'available' as const,
    })),
    methodology: {
      general:
        'Agregación determinística de observaciones, eventos, hallazgos y operaciones TerraMind sin narrativa generativa.',
      sources: ['NASA FIRMS', 'Motores de correlación TerraMind', 'Evidencia de campo validada'],
      period: reportPeriodMeta(report.period).label,
      geography: 'Territorio nacional de Guatemala',
      filtering: 'Exclusión de demo salvo bandera explícita; legacy separado de operacional',
      deduplication: 'Reglas de deduplicación espacio-temporal del motor de eventos',
      eventGrouping: 'Correlación en incidentes con reglas de proximidad temporal',
      priorityModel: 'Modelo de tres scores: Atención, Verificación, Acción',
      classificationRules: 'operational / legacy / demo según ownership y origen',
      version: REPORT_THEME.documentVersion,
    },
    limitations,
    sources: [
      {
        name: 'NASA FIRMS',
        type: 'Actividad térmica satelital',
        coverage: 'Nacional',
        period: report.period.preset,
        lastUpdated: dashboard.last_sync_at ?? 'n/d',
        status: dashboard.sources_active > 0 ? 'Activa' : 'Sin datos recientes',
        limitation: 'No confirma incendio por sí sola',
      },
      {
        name: 'Motores TerraMind',
        type: 'Correlación e interpretación',
        coverage: 'Nacional',
        period: reportPeriodMeta(report.period).label,
        lastUpdated: formatReportGeneratedAt(report.generated_at),
        status: 'Operacional',
        limitation: 'Depende de calidad de fuentes upstream',
      },
    ],
    watermark: classification === 'demo' ? 'DEMOSTRACIÓN INTERNA' : undefined,
  }

  return institutional
}
