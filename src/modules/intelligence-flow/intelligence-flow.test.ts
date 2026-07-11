import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildIntelligenceFlowActions } from './intelligence-flow-actions'
import { FLOW_STAGE_ORDER, FLOW_STAGE_LABELS } from './intelligence-flow.constants'
import type { IntelligenceFlowDto } from './intelligence-flow.types'
import {
  buildIncidentBreadcrumbLabel,
  buildIncidentDisplayName,
} from '@/modules/incidents/utils/incident-display-name'
import type { TerramindPermission } from '@/core/auth/permissions'

function fullFlow(overrides: Partial<IntelligenceFlowDto> = {}): IntelligenceFlowDto {
  return {
    resource_type: 'incident',
    resource_id: '11111111-1111-4111-8111-111111111111',
    current_stage: 'incident',
    classification: 'operational',
    generated_at: new Date().toISOString(),
    nodes: FLOW_STAGE_ORDER.map((stage) => ({
      stage,
      status: stage === 'mission' ? 'not_required' : 'available',
      label: FLOW_STAGE_LABELS[stage],
      route:
        stage === 'finding'
          ? '/hallazgos/a'
          : stage === 'priority'
            ? '/prioridades/b'
            : stage === 'incident'
              ? '/incidentes/c'
              : stage === 'verification'
                ? '/incidentes/c#verificacion'
                : stage === 'mission'
                  ? undefined
                  : stage === 'evidence'
                    ? '/misiones/d#evidencia'
                    : stage === 'resolution'
                      ? '/incidentes/c#resolucion'
                      : stage === 'response'
                        ? '/respuesta/c'
                        : '/informes/incidentes/c',
      blockingReason:
        stage === 'mission'
          ? 'No se recomienda una misión porque la revisión remota es suficiente para esta pregunta.'
          : undefined,
    })),
    ...overrides,
  }
}

const allPerms = new Set<TerramindPermission>([
  'findings.view',
  'priorities.view',
  'incidents.view',
  'verification_plans.view',
  'missions.view',
  'evidence.view',
  'responses.view',
])

describe('intelligence flow actions', () => {
  it('emits link CTAs only when node is available with route', () => {
    const actions = buildIntelligenceFlowActions(fullFlow(), allPerms)
    const linked = actions.filter((a) => a.route)
    expect(linked.some((a) => a.label === 'Ver hallazgo')).toBe(true)
    expect(linked.some((a) => a.label === 'Generar informe')).toBe(true)
    expect(linked.some((a) => a.label === 'Ver misión')).toBe(false)
  })

  it('shows contextual explanation for not_required mission', () => {
    const actions = buildIntelligenceFlowActions(fullFlow(), allPerms)
    const ctx = actions.find((a) => a.id === 'mission-ctx')
    expect(ctx?.explanation).toContain('revisión remota')
  })

  it('respects permissions', () => {
    const actions = buildIntelligenceFlowActions(fullFlow(), new Set(['incidents.view']))
    expect(actions.some((a) => a.route?.includes('/hallazgos'))).toBe(false)
    expect(actions.some((a) => a.route?.includes('/incidentes'))).toBe(false)
  })

  it('handles partial flow with missing response', () => {
    const flow = fullFlow({
      nodes: fullFlow().nodes.map((n) =>
        n.stage === 'response'
          ? {
              ...n,
              status: 'missing' as const,
              route: undefined,
              blockingReason: 'Aún no existe una evaluación de respuesta.',
            }
          : n,
      ),
    })
    const actions = buildIntelligenceFlowActions(flow, allPerms)
    expect(actions.find((a) => a.id === 'response-ctx')?.explanation).toContain('evaluación de respuesta')
  })

  it('marks legacy classification on incident node', () => {
    const flow = fullFlow({
      classification: 'legacy',
      nodes: fullFlow().nodes.map((n) =>
        n.stage === 'incident' ? { ...n, status: 'legacy' as const, classification: 'legacy' as const } : n,
      ),
    })
    expect(flow.nodes.find((n) => n.stage === 'incident')?.status).toBe('legacy')
  })
})

describe('incident display name', () => {
  it('never shows event count alarmist title', () => {
    const name = buildIncidentDisplayName({
      incident_type: 'vegetation_fire',
      department_name: 'Quetzaltenango',
      event_count: 1,
      lifecycle_state: 'lifecycle_persistent',
    })
    expect(name).not.toContain('evento(s)')
    expect(name).toContain('Actividad térmica')
    expect(name).toContain('Quetzaltenango')
  })

  it('breadcrumb label avoids raw UUID shape', () => {
    const label = buildIncidentBreadcrumbLabel({
      incident_type: 'fire',
      department_name: 'Huehuetenango',
      event_count: 2,
    })
    expect(label).not.toMatch(/^[0-9a-f-]{36}$/i)
  })
})

describe('flow stage order', () => {
  it('covers full operational cycle', () => {
    expect(FLOW_STAGE_ORDER).toEqual([
      'finding',
      'priority',
      'incident',
      'verification',
      'mission',
      'evidence',
      'resolution',
      'response',
      'report',
    ])
  })
})

describe('detail pages wiring', () => {
  const detailPages = [
    'src/modules/findings/pages/FindingDetailPage.tsx',
    'src/modules/priorities/pages/PriorityDetailPage.tsx',
    'src/modules/incidents/pages/IncidentDetailPage.tsx',
    'src/modules/missions/pages/MissionDetailPage.tsx',
    'src/modules/response-orchestration/pages/ResponseOrchestrationDetailPage.tsx',
    'src/modules/executive-demo/pages/IncidentReportPage.tsx',
  ]

  for (const page of detailPages) {
    it(`${page} includes flow navigator hook`, () => {
      const src = readFileSync(resolve(page), 'utf8')
      expect(src).toContain('IntelligenceFlowSections')
      expect(src).toContain('PageHeader')
    })
  }
})

describe('single flow request', () => {
  it('IntelligenceFlowSections uses one hook', () => {
    const src = readFileSync(
      resolve('src/modules/intelligence-flow/components/IntelligenceFlowSections.tsx'),
      'utf8',
    )
    expect(src).toContain('useIntelligenceFlow')
    expect(src.match(/useIntelligenceFlow\(/g)?.length).toBe(1)
  })
})
