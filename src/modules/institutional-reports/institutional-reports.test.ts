import { describe, expect, it } from 'vitest'
import { buildNationalInstitutionalReport } from './builders/national-report.builder'
import { buildIncidentInstitutionalReport } from './builders/incident-report.builder'
import {
  canMarkOfficial,
  classificationBanner,
  classificationLabel,
  fromLegacyReportClassification,
  resolveInstitutionalClassification,
} from './report-classification'
import { institutionalReportFilename } from './report-filename'
import { formatReportGeneratedAt, reportPeriodMeta } from './report-period'
import type { ExecutiveDashboardDto, IncidentReportDto, NationalReportDto } from '@/modules/executive-demo/types/executive-demo.types'
import type { ExecutiveMetric } from '@/modules/executive-metrics/executive-metric.types'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function baseMetrics(): ExecutiveMetric[] {
  return [
    {
      id: 'fire_observations',
      label: 'Observaciones recibidas',
      value: 10,
      scope: 'national',
      source: 'FIRMS',
      timeWindow: { label: '48 h', kind: 'rolling' },
      breakdown: [{ label: 'operacional', value: 10, classification: 'operational', included: true }],
      limitations: [],
    },
    {
      id: 'incidents_operational',
      label: 'Incidentes operacionales',
      value: 0,
      scope: 'national',
      source: 'TerraMind',
      timeWindow: { label: 'periodo', kind: 'period' },
      breakdown: [{ label: 'operacional', value: 0, classification: 'operational', included: true }],
      limitations: [],
    },
    {
      id: 'pending_decisions',
      label: 'Decisiones pendientes',
      value: 0,
      scope: 'national',
      source: 'TerraMind',
      timeWindow: { label: 'actual', kind: 'snapshot' },
      breakdown: [{ label: 'operacional', value: 0, classification: 'operational', included: true }],
      limitations: [],
    },
  ] as ExecutiveMetric[]
}

function baseDashboard(overrides: Partial<ExecutiveDashboardDto> = {}): ExecutiveDashboardDto {
  return {
    generated_at: '2026-07-11T06:45:00.000Z',
    system_status: 'operational',
    last_sync_at: '2026-07-11T06:00:00.000Z',
    sources_active: 2,
    include_demo: false,
    metrics: [],
    summary: {
      what_is_happening: 'Actividad térmica monitoreada sin confirmación de incendio.',
      what_changed: 'Sin cambios significativos.',
      requires_attention: 'Revisar hallazgos activos.',
      in_verification: 'Verificación pendiente en algunos casos.',
      terramind_recommends: 'Aún no existe evaluación formal.',
      pending_decision: 'Sin decisiones pendientes.',
    },
    priority_findings: [],
    active_incidents: [],
    recent_changes: [],
    pending_verifications: [],
    missions_in_progress: [],
    recent_evidence: [],
    recent_resolutions: [],
    response_recommendations: [],
    pending_decisions: [],
    empty_sections: [],
    data_audit: [{ stage: 'incidents', count: 0, status: 'empty', note: '' }],
    recommended_demo_incident_id: null,
    ...overrides,
  }
}

function baseNationalReport(): NationalReportDto {
  return {
    title: 'Informe Nacional de Inteligencia Ambiental',
    classification: 'draft',
    period: { preset: '7d', from: '2026-07-04T00:00:00.000Z', to: '2026-07-10T23:59:59.000Z' },
    generated_at: '2026-07-11T06:45:00.000Z',
    dashboard: baseDashboard(),
    canonical_metrics: baseMetrics(),
    sections: [
      { id: 'methodology', title: 'Metodología', content: 'Agregación determinística.' },
      { id: 'limitations', title: 'Limitaciones', content: 'Actividad térmica no confirma incendio.' },
    ],
  }
}

describe('institutional report classification', () => {
  it('translates classifications to Spanish banners', () => {
    expect(classificationLabel('draft')).toBe('BORRADOR')
    expect(classificationBanner('draft')).toBe('BORRADOR · USO INTERNO')
    expect(classificationBanner('demo')).toBe('DEMOSTRACIÓN INTERNA')
    expect(fromLegacyReportClassification('internal_demo', false)).toBe('demo')
  })

  it('blocks official when demo is included', () => {
    expect(
      canMarkOfficial({
        classification: 'internal',
        includeDemo: true,
        hasLegacyAsOperational: false,
        hasPeriod: true,
        hasSources: true,
        hasMethodology: true,
        hasIncompleteCriticalSections: false,
        hasAssessmentWhenRecommending: true,
      }),
    ).toBe(false)
    expect(resolveInstitutionalClassification('verified', true, {
      hasLegacyAsOperational: false,
      hasPeriod: true,
      hasSources: true,
      hasMethodology: true,
      hasIncompleteCriticalSections: false,
      hasAssessmentWhenRecommending: true,
    })).toBe('demo')
  })

  it('blocks official without methodology or period', () => {
    expect(
      canMarkOfficial({
        classification: 'internal',
        includeDemo: false,
        hasLegacyAsOperational: false,
        hasPeriod: false,
        hasSources: true,
        hasMethodology: true,
        hasIncompleteCriticalSections: false,
        hasAssessmentWhenRecommending: true,
      }),
    ).toBe(false)
  })
})

describe('national institutional report builder', () => {
  it('builds required sections with methodology, limitations and sources', () => {
    const report = buildNationalInstitutionalReport(baseNationalReport(), false)
    expect(report.type).toBe('national')
    expect(report.title).toContain('Informe Nacional')
    expect(report.methodology.general.length).toBeGreaterThan(10)
    expect(report.limitations.length).toBeGreaterThan(2)
    expect(report.sources.length).toBeGreaterThan(0)
    expect(report.metrics.length).toBeGreaterThan(0)
  })

  it('matches dashboard KPI values in report metrics', () => {
    const dto = baseNationalReport()
    const report = buildNationalInstitutionalReport(dto, false)
    for (const m of report.metrics) {
      const canonical = dto.canonical_metrics!.find((c) => c.id === m.id)
      expect(canonical?.value).toBe(m.value)
    }
  })

  it('uses empty message instead of empty incidents table', () => {
    const report = buildNationalInstitutionalReport(baseNationalReport(), false)
    expect(report.incidents).toHaveLength(0)
  })

  it('never marks demo as official', () => {
    const report = buildNationalInstitutionalReport(baseNationalReport(), true)
    expect(report.classification).toBe('demo')
    expect(report.watermark).toBe('DEMOSTRACIÓN INTERNA')
  })

  it('does not recommend without assessment', () => {
    const report = buildNationalInstitutionalReport(baseNationalReport(), false)
    expect(report.executiveSummary.content).toContain('Aún no existe una evaluación formal')
  })

  it('separates legacy incidents', () => {
    const dto = baseNationalReport()
    dto.dashboard = baseDashboard({
      active_incidents: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          status: 'active',
          attention_level: 'medium',
          event_count: 2,
          story_coverage: 'parcial',
          is_legacy: true,
          is_internal_demo: false,
          href: '/incidentes/x',
          story_href: '/incidentes/x/historia',
        },
      ],
    })
    const report = buildNationalInstitutionalReport(dto, false)
    expect(report.incidents).toHaveLength(0)
    expect(report.legacyIncidents).toHaveLength(1)
  })
})

describe('incident institutional report builder', () => {
  it('documents stages without UUID titles', () => {
    const dto: IncidentReportDto = {
      title: 'Informe por incidente · Actividad térmica aislada',
      classification: 'draft',
      incident_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      generated_at: '2026-07-11T06:45:00.000Z',
      story: {
        incident_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        generated_at: '2026-07-11T06:45:00.000Z',
        is_internal_demo: false,
        is_legacy: false,
        classification: 'draft',
        coverage: {
          label: '3 de 8 etapas',
          present_stages: 3,
          total_stages: 8,
          missing_stage_labels: ['Misiones'],
        },
        stages: [
          {
            key: 'events',
            order: 1,
            title: 'Eventos observados',
            summary: 'Eventos correlacionados.',
            detail: null,
            status: 'present',
            epistemic: 'observed',
            timestamp: '2026-07-10T12:00:00.000Z',
            source: 'FIRMS',
            confidence: 'media',
          },
        ],
        timeline: [
          {
            stage: 'events',
            stage_label: 'Eventos',
            summary: 'Detección registrada',
            timestamp: '2026-07-10T12:00:00.000Z',
            epistemic: 'observed',
            source: 'FIRMS',
          },
        ],
      },
      sections: [],
    }
    const report = buildIncidentInstitutionalReport(dto, false)
    expect(report.title).not.toContain('aaaaaaaa')
    expect(report.sections.some((s) => s.title === 'Eventos observados')).toBe(true)
    expect(report.timeline.every((t) => !t.reference.match(/^[0-9a-f-]{36}$/i))).toBe(true)
  })
})

describe('report filename', () => {
  it('uses Spanish slug without UUID', () => {
    const name = institutionalReportFilename('national', 'draft', {
      periodFrom: '2026-07-04',
      periodTo: '2026-07-10',
    })
    expect(name).toBe('terramind_informe_nacional_2026-07-04_2026-07-10_borrador.pdf')
    expect(name).not.toMatch(/[A-F0-9]{8}-[A-F0-9]{4}/i)
  })

  it('builds incident filename from slug', () => {
    const name = institutionalReportFilename('incident', 'internal', {
      incidentSlug: 'Actividad térmica aislada',
      generatedAt: '2026-07-11T06:45:00.000Z',
    })
    expect(name).toMatch(/^terramind_incidente_actividad_termica_aislada_2026-07-11_uso_interno\.pdf$/)
  })
})

describe('report period Guatemala timezone', () => {
  it('formats period label in es-GT', () => {
    const meta = reportPeriodMeta({
      preset: '7d',
      from: '2026-07-04T00:00:00.000Z',
      to: '2026-07-10T23:59:59.000Z',
    })
    expect(meta.timezone).toBe('America/Guatemala')
    expect(meta.label).toMatch(/julio/)
    expect(formatReportGeneratedAt('2026-07-11T06:45:00.000Z')).toMatch(/2026/)
  })
})

describe('print styles and HTML structure', () => {
  it('includes A4 print rules and classification', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/modules/institutional-reports/report-print.css'), 'utf8')
    expect(css).toContain('@page')
    expect(css).toContain('210mm')
    expect(css).toContain('break-inside')
  })

  it('InstitutionalReportView uses institutional model', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/modules/institutional-reports/components/InstitutionalReportView.tsx'),
      'utf8',
    )
    expect(src).toContain('InstitutionalReport')
    expect(src).toContain('lang="es"')
    expect(src).toContain('Metodología')
    expect(src).toContain('Limitaciones')
  })
})

describe('HTML/PDF pipeline wiring', () => {
  it('reports service attaches institutional model', () => {
    const src = readFileSync(resolve(process.cwd(), 'server/services/reports.service.ts'), 'utf8')
    expect(src).toContain('buildNationalInstitutionalReport')
    expect(src).toContain('report.institutional')
  })

  it('PDF service uses institutional renderer when present', () => {
    const pdfSrc = readFileSync(resolve(process.cwd(), 'server/services/reports-pdf.service.ts'), 'utf8')
    expect(pdfSrc).toContain('renderInstitutionalReportPdf')
    expect(pdfSrc).toContain('report.institutional')
  })
})
