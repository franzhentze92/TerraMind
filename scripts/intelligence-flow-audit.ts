#!/usr/bin/env tsx
/**
 * intelligence-flow:audit — Product Consolidation Phase 4 gate.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { FORBIDDEN_UI_TERMS, findInternalPhaseCodes } from '@/shared/product-language'
import { FLOW_STAGE_ORDER } from '@/modules/intelligence-flow/intelligence-flow.constants'
import { buildIntelligenceFlowActions } from '@/modules/intelligence-flow/intelligence-flow-actions'
import type { IntelligenceFlowDto } from '@/modules/intelligence-flow/intelligence-flow.types'
import { buildIncidentDisplayName } from '@/modules/incidents/utils/incident-display-name'
import { OPERATIONAL_ROUTE_REGISTRY } from '../server/auth/route-registry.js'

const ROOT = process.cwd()
const failures: string[] = []
const passes: string[] = []

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) passes.push(name)
  else failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
}

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8')
}

const requiredFiles = [
  'docs/product-consolidation/PHASE-4-INTELLIGENCE-FLOW-AUDIT.md',
  'src/modules/intelligence-flow/intelligence-flow.types.ts',
  'src/modules/intelligence-flow/intelligence-flow.constants.ts',
  'src/modules/intelligence-flow/intelligence-flow-actions.ts',
  'src/modules/intelligence-flow/api/intelligence-flow-api.ts',
  'src/modules/intelligence-flow/components/IntelligenceFlowNavigator.tsx',
  'src/modules/intelligence-flow/components/IntelligenceFlowActionsPanel.tsx',
  'src/modules/intelligence-flow/components/IntelligenceFlowSections.tsx',
  'src/modules/intelligence-flow/components/PriorityScoreExplanation.tsx',
  'src/modules/intelligence-flow/intelligence-flow.test.ts',
  'server/services/intelligence-flow.service.ts',
  'server/routes/intelligence-flow.ts',
  'scripts/intelligence-flow-audit.ts',
]

for (const f of requiredFiles) {
  check(`file:${f}`, existsSync(resolve(ROOT, f)))
}

check('flow-stage-count', FLOW_STAGE_ORDER.length === 9)

const detailPages = [
  'src/modules/findings/pages/FindingDetailPage.tsx',
  'src/modules/priorities/pages/PriorityDetailPage.tsx',
  'src/modules/incidents/pages/IncidentDetailPage.tsx',
  'src/modules/missions/pages/MissionDetailPage.tsx',
  'src/modules/response-orchestration/pages/ResponseOrchestrationDetailPage.tsx',
  'src/modules/executive-demo/pages/IncidentReportPage.tsx',
]

for (const page of detailPages) {
  const src = read(page)
  check(`${page}:flow-navigator`, src.includes('IntelligenceFlowSections'))
  check(`${page}:page-header`, src.includes('PageHeader'))
  check(`${page}:no-module-header`, !src.includes('ModuleHeader'))
  for (const term of FORBIDDEN_UI_TERMS) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(?<![.\\w])${escaped}`, 'i')
    if (re.test(src)) {
      check(`${page}:forbidden-term`, false, term)
    }
  }
  const phaseCodes = findInternalPhaseCodes(src)
  check(`${page}:no-phase-codes`, phaseCodes.length === 0, phaseCodes.join(', '))
}

const responseSrc = read('src/modules/response-orchestration/pages/ResponseOrchestrationDetailPage.tsx')
check(
  'response:separates-recommendation-decision',
  responseSrc.includes('Recomendación') && responseSrc.includes('Decisión humana'),
)
check(
  'response:empty-assessment',
  responseSrc.includes('Aún no existe una evaluación de respuesta'),
)

const prioritySrc = read('src/modules/priorities/pages/PriorityDetailPage.tsx')
check('priority:score-explanation', prioritySrc.includes('PriorityScoreExplanation'))

const missionSrc = read('src/modules/missions/pages/MissionDetailPage.tsx')
check('mission:evidence-anchor', missionSrc.includes('id="evidencia"'))

const incidentName = buildIncidentDisplayName({
  incident_type: 'vegetation_fire',
  department_name: 'Quetzaltenango',
  event_count: 1,
  lifecycle_state: 'lifecycle_persistent',
})
check('incident-name-deterministic', !incidentName.includes('evento(s)'))

const registryOk = OPERATIONAL_ROUTE_REGISTRY.some(
  (r) => r.path === '/api/intelligence-flow/:resourceType/:resourceId',
)
check('route-registry:intelligence-flow', registryOk)

const flowApi = read('src/modules/intelligence-flow/api/intelligence-flow-api.ts')
check('flow-api:single-endpoint', flowApi.includes('/api/intelligence-flow/'))

const mockFlow: IntelligenceFlowDto = {
  resource_type: 'finding',
  resource_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  current_stage: 'finding',
  classification: 'operational',
  generated_at: new Date().toISOString(),
  nodes: FLOW_STAGE_ORDER.map((stage) => ({
    stage,
    status: stage === 'priority' ? 'available' : 'missing',
    label: stage,
    route: stage === 'priority' ? '/prioridades/x' : undefined,
  })),
}

const actions = buildIntelligenceFlowActions(mockFlow, new Set(['priorities.view', 'findings.view']))
check(
  'cta:priority-when-exists',
  actions.some((a) => a.route === '/prioridades/x'),
)
check(
  'cta:no-disabled-without-explanation',
  !actions.some((a) => a.disabled && !a.explanation && !a.route),
)

const serviceSrc = read('server/services/intelligence-flow.service.ts')
check('service:no-synthetic-data', !serviceSrc.includes('faker') && !serviceSrc.includes('synthetic'))

console.log('\n=== intelligence-flow:audit ===')
console.log(`Passed: ${passes.length}`)
console.log(`Failed: ${failures.length}`)
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`)
  process.exit(1)
}
console.log('AUDIT PASSED')
process.exit(0)
