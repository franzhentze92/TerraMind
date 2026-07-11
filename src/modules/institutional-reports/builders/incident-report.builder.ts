import type { IncidentReportDto } from '@/modules/executive-demo/types/executive-demo.types'
import { buildIncidentDisplayName } from '@/modules/incidents/utils/incident-display-name'
import type { InstitutionalReport, ReportSection, ReportTimelineRow } from '../institutional-report.types'
import { classificationBanner, fromLegacyReportClassification } from '../report-classification'
import { formatReportGeneratedAt } from '../report-period'
import { REPORT_THEME } from '../report-theme'

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

function stageStatusMessage(status: string): ReportSection['status'] {
  if (status === 'missing') return 'pending'
  if (status === 'not_applicable') return 'not_required'
  if (status === 'blocked') return 'unavailable'
  return 'available'
}

function stageContent(stage: IncidentReportDto['story']['stages'][0]): string {
  if (stage.status === 'missing') {
    return (
      stage.empty_state?.meaning ??
      'Etapa pendiente — se completará cuando el proceso operacional avance.'
    )
  }
  if (stage.status === 'not_applicable') {
    return 'No se requiere verificación adicional para esta etapa.'
  }
  return [stage.summary, stage.detail].filter(Boolean).join('\n\n')
}

export function buildIncidentInstitutionalReport(
  report: IncidentReportDto,
  includeDemo: boolean,
  organization?: string,
): InstitutionalReport {
  const story = report.story
  const classification = fromLegacyReportClassification(report.classification, includeDemo)
  const displayName = buildIncidentDisplayName({ incident_type: 'fire', event_count: story.timeline.length || 1 })

  const sections: ReportSection[] = [
    {
      id: 'identification',
      title: 'Identificación',
      content: `${displayName}\nCobertura de historia: ${story.coverage.label}`,
      status: 'available',
    },
    {
      id: 'executive-summary',
      title: 'Resumen ejecutivo',
      content: `Etapas documentadas: ${story.coverage.present_stages} de ${story.coverage.total_stages}.\nFaltantes: ${story.coverage.missing_stage_labels.join(' · ') || 'Ninguna'}.`,
      status: 'available',
    },
    ...story.stages.map((stage) => ({
      id: stage.key,
      title: stage.title,
      content: stageContent(stage),
      status: stageStatusMessage(stage.status),
    })),
  ]

  const timeline: ReportTimelineRow[] = story.timeline.map((t) => ({
    date: t.timestamp,
    stage: t.stage_label,
    event: t.summary,
    epistemic: epistemicLabel(t.epistemic),
    source: t.source,
    actor: 'Sistema',
    reference: t.stage,
  }))

  return {
    id: `incident-${report.incident_id}`,
    type: 'incident',
    title: `Informe por incidente · ${displayName}`,
    subtitle: REPORT_THEME.brandSubtitle,
    classification,
    classificationLabel: classificationBanner(classification),
    status: 'ready',
    period: {
      from: story.generated_at,
      to: story.generated_at,
      label: formatReportGeneratedAt(story.generated_at),
      timezone: 'America/Guatemala',
    },
    territory: { label: 'Guatemala', scope: 'incident' },
    generatedAt: report.generated_at,
    organization,
    documentVersion: REPORT_THEME.documentVersion,
    incidentId: report.incident_id,
    executiveSummary: sections[1],
    metrics: [],
    maps: [
      {
        id: 'incident-map',
        title: 'Ubicación del incidente',
        territoryLabel: 'Guatemala',
        periodLabel: formatReportGeneratedAt(report.generated_at),
        source: 'Datos del incidente',
        legend: ['Eventos correlacionados'],
        available: false,
        errorMessage: 'Mapa no disponible en esta generación.',
        fallbackRows: timeline.slice(0, 5).map((t) => ({ label: t.stage, detail: t.event })),
      },
    ],
    findings: [],
    incidents: [],
    legacyIncidents: story.is_legacy
      ? [
          {
            id: report.incident_id,
            name: displayName,
            location: 'Ownership pendiente',
            lifecycle: 'legacy',
            priority: 'n/d',
            eventCount: story.timeline.length,
            verificationStatus: story.coverage.label,
            nextStep: 'Asignar organización',
            classification: 'legacy',
          },
        ]
      : [],
    demoIncidents: story.is_internal_demo
      ? [
          {
            id: report.incident_id,
            name: displayName,
            location: 'Demostración',
            lifecycle: 'demo',
            priority: 'n/d',
            eventCount: story.timeline.length,
            verificationStatus: story.coverage.label,
            nextStep: 'No operacional',
            classification: 'demo',
          },
        ]
      : [],
    verification: {
      activeNeeds: 0,
      legacyPlans: 0,
      missionsRecommended: 0,
      remoteSufficient: true,
      summary: story.coverage.missing_stage_labels.join(' · ') || 'Historia documentada',
    },
    operations: {
      missionsOperational: 0,
      missionsDemo: story.is_internal_demo ? 1 : 0,
      evidenceOperational: 0,
      resolutionsCount: 0,
      responseAssessments: 0,
      pendingDecisions: 0,
      summary: story.coverage.label,
    },
    timeline,
    sections,
    methodology: {
      general: 'Documentación determinística del ciclo operacional TerraMind para un incidente.',
      sources: ['NASA FIRMS', 'Motores TerraMind', 'Evidencia validada'],
      period: formatReportGeneratedAt(story.generated_at),
      geography: 'Contexto territorial del incidente',
      filtering: 'Separación legacy/demo/operacional',
      deduplication: 'Según reglas del motor de eventos',
      eventGrouping: 'Correlación en incidente',
      priorityModel: 'Atención · Verificación · Acción',
      classificationRules: 'Clasificación epistemológica por etapa',
      version: REPORT_THEME.documentVersion,
    },
    limitations: [
      'La actividad térmica no confirma incendio ni daño.',
      ...(story.is_legacy ? ['Incidente legacy — ownership organizacional pendiente.'] : []),
      ...(story.is_internal_demo ? ['Demostración interna — no representa evento confirmado.'] : []),
      'Etapas faltantes no implican ausencia del fenómeno.',
    ],
    sources: [
      {
        name: 'Historia del incidente TerraMind',
        type: 'Agregación operacional',
        coverage: 'Incidente',
        period: formatReportGeneratedAt(story.generated_at),
        lastUpdated: formatReportGeneratedAt(story.generated_at),
        status: 'Documentado',
        limitation: 'Depende de etapas registradas',
      },
    ],
    watermark: classification === 'demo' ? 'DEMOSTRACIÓN INTERNA' : undefined,
  }
}
