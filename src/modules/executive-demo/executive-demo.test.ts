import { describe, expect, it } from 'vitest'
import { containsForbiddenExecutiveCopy, assertSafeExecutiveCopy } from './copy-guard/executive-copy-guard'
import { buildExecutiveSummary, buildDataAudit } from './narrative/executive-summary.builder'
import {
  buildStoryCoverage,
  STORY_STAGE_KEYS,
  STORY_STAGE_LABELS,
} from './narrative/story-coverage'
import {
  assertNeverAutoVerified,
  resolveIncidentReportClassification,
  resolveNationalReportClassification,
} from './narrative/report-classification'
import { isInternalDemoIncidentId, isInternalDemoMissionTitle } from './demo-config'
import { INTERNAL_DEMO_INCIDENT_ID } from './demo-config'
import type { ExecutiveDashboardDto } from './types/executive-demo.types'

function baseDashboard(overrides: Partial<ExecutiveDashboardDto> = {}): ExecutiveDashboardDto {
  return {
    generated_at: new Date().toISOString(),
    system_status: 'operational',
    last_sync_at: null,
    sources_active: 3,
    include_demo: false,
    metrics: [
      { key: 'incidents', label: 'Incidentes', value: 0 },
      { key: 'missions', label: 'Misiones', value: 0 },
      { key: 'evidence', label: 'Evidencia', value: 0 },
    ],
    summary: {
      what_is_happening: 'x',
      what_changed: 'x',
      requires_attention: 'x',
      in_verification: 'x',
      terramind_recommends: 'x',
      pending_decision: 'x',
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
    data_audit: [
      { stage: 'incidents', count: 4, status: 'legacy_only', note: 'legacy' },
      { stage: 'evidence_validations', count: 0, status: 'empty', note: 'empty' },
      { stage: 'verification_need_resolutions', count: 0, status: 'empty', note: 'empty' },
      { stage: 'response_assessments', count: 0, status: 'empty', note: 'empty' },
    ],
    recommended_demo_incident_id: null,
    ...overrides,
  }
}

describe('executive copy guard', () => {
  it('blocks forbidden claims', () => {
    expect(containsForbiddenExecutiveCopy('incendio confirmado')).toBe(true)
    expect(containsForbiddenExecutiveCopy('Monitoreo térmico activo')).toBe(false)
  })

  it('assertSafeExecutiveCopy throws on forbidden', () => {
    expect(() => assertSafeExecutiveCopy('emergencia nacional')).toThrow()
  })
})

describe('executive summary builder', () => {
  it('builds deterministic narrative without LLM', () => {
    const s = buildExecutiveSummary({
      fireEvents: 14,
      findings: 50,
      incidents: 4,
      tenantIncidents: 0,
      missions: 2,
      evidence: 1,
      validations: 0,
      resolutions: 0,
      assessments: 0,
      decisions: 0,
      systemStatus: 'operational',
    })
    expect(s.what_is_happening).toContain('14')
    expect(s.terramind_recommends).toContain('assessment')
  })

  it('data audit marks legacy incidents', () => {
    const audit = buildDataAudit({
      fire_detections: 97,
      fire_events: 14,
      composite_findings: 50,
      finding_priority_assessments: 11,
      incidents_total: 4,
      incidents_tenant: 0,
      incidents_legacy: 4,
      event_lifecycle_transitions: 12,
      verification_plans: 4,
      verification_needs: 0,
      missions: 2,
      evidence_submissions: 1,
      evidence_validations: 0,
      verification_need_resolutions: 0,
      response_assessments: 0,
      decision_records: 0,
      response_actions: 0,
    })
    const inc = audit.find((a) => a.stage === 'incidents')
    expect(inc?.status).toBe('legacy_only')
  })
})

describe('story coverage', () => {
  it('computes coverage label with stable denominator of 9', () => {
    const c = buildStoryCoverage({
      event: true,
      finding: true,
      priority: true,
      lifecycle: true,
      plan: true,
      mission: true,
      evidence: true,
      resolution: false,
      response: false,
    })
    expect(c.present_stages).toBe(7)
    expect(c.label).toContain('7 de 9')
    expect(STORY_STAGE_KEYS.length).toBe(9)
    expect(c.present_stage_labels).toHaveLength(7)
    expect(c.missing_stage_labels).toEqual([
      STORY_STAGE_LABELS.resolution,
      STORY_STAGE_LABELS.response,
    ])
  })
})

describe('report classification', () => {
  it('never auto-classifies as verified', () => {
    expect(assertNeverAutoVerified('verified')).toBe('draft')
    expect(assertNeverAutoVerified('draft')).toBe('draft')
  })

  it('national report is draft without tenant incidents and empty pipeline', () => {
    expect(resolveNationalReportClassification(baseDashboard(), false)).toBe('draft')
  })

  it('national report with demo flag is internal_demo', () => {
    expect(resolveNationalReportClassification(baseDashboard(), true)).toBe('internal_demo')
  })

  it('incident demo report is internal_demo', () => {
    expect(
      resolveIncidentReportClassification({
        includeDemo: true,
        isInternalDemo: false,
        isLegacy: false,
        presentStages: 9,
      }),
    ).toBe('internal_demo')
  })

  it('legacy incident without full coverage stays draft', () => {
    expect(
      resolveIncidentReportClassification({
        includeDemo: false,
        isInternalDemo: false,
        isLegacy: true,
        presentStages: 7,
        totalStages: 9,
      }),
    ).toBe('draft')
  })
})

describe('demo separation', () => {
  it('identifies internal demo incident', () => {
    expect(isInternalDemoIncidentId(INTERNAL_DEMO_INCIDENT_ID)).toBe(true)
    expect(isInternalDemoIncidentId('00000000-0000-4000-a07f-00000000e001')).toBe(false)
  })

  it('identifies pilot missions', () => {
    expect(isInternalDemoMissionTitle('Field Sync Pilot — Internal Verification')).toBe(true)
    expect(isInternalDemoMissionTitle('Misión real')).toBe(false)
  })

  it('excludes pilot missions from national KPI when demo off', () => {
    const dashboard = baseDashboard({
      include_demo: false,
      metrics: [
        { key: 'missions', label: 'Misiones', value: 0 },
        { key: 'evidence', label: 'Evidencia', value: 0 },
      ],
      missions_in_progress: [],
      recent_evidence: [],
      recent_changes: [],
    })
    expect(dashboard.missions_in_progress.every((m) => !m.is_internal_demo)).toBe(true)
    expect(dashboard.metrics.find((m) => m.key === 'missions')?.value).toBe(0)
    expect(dashboard.metrics.find((m) => m.key === 'evidence')?.value).toBe(0)
  })

  it('timeline demo entries require include_demo', () => {
    const withoutDemo = baseDashboard().recent_changes.filter((e) => !e.is_internal_demo)
    const withDemo = [
      ...withoutDemo,
      {
        id: 'm1',
        timestamp: '2026-01-01T00:00:00Z',
        stage: 'mission',
        stage_label: 'Misión',
        status: 'active',
        source: 'demo',
        confidence: 'observado',
        summary: 'Field Sync Pilot',
        epistemic: 'observed' as const,
        is_internal_demo: true,
      },
    ]
    expect(withoutDemo.every((e) => !e.is_internal_demo)).toBe(true)
    expect(withDemo.some((e) => e.is_internal_demo)).toBe(true)
  })

  it('national PDF classification is not verified by default', () => {
    const classification = resolveNationalReportClassification(baseDashboard(), false)
    expect(classification).not.toBe('verified')
  })
})

describe('route aliases', () => {
  it('keeps /situacion and /situacion-nacional as sibling routes', async () => {
    const routerSource = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('../../app/router.tsx', import.meta.url), 'utf8'),
    )
    expect(routerSource).toContain("{ path: 'situacion'")
    expect(routerSource).toContain('NationalSituationPage')
    expect(routerSource).toContain("{ path: 'situacion-nacional'")
    expect(routerSource).not.toContain("{ path: 'situacion-nacional', element: <Navigate to=\"/situacion\"")
  })
})

describe('timeline ordering', () => {
  it('sorts entries chronologically', () => {
    const entries = [
      { timestamp: '2026-01-02T00:00:00Z' },
      { timestamp: '2026-01-01T00:00:00Z' },
    ]
    entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    expect(entries[0].timestamp).toBe('2026-01-01T00:00:00Z')
  })
})
