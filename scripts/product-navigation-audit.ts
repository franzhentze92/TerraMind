#!/usr/bin/env tsx
/**
 * product-navigation:audit — Product Consolidation Phase 2 gate.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  CAMPO_SECONDARY_NAV,
  getPrimaryNavForSection,
  ROUTE_REGISTRY,
} from '@/shared/navigation/navigation-registry'
import { FORBIDDEN_UI_TERMS, findInternalPhaseCodes } from '@/shared/product-language'

const failures: string[] = []
const passes: string[] = []

function check(name: string, ok: boolean, detail = '') {
  if (ok) passes.push(name)
  else failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
}

// 1. Single Campo primary entry
const campoPrimary = getPrimaryNavForSection('campo')
check('campo-single-primary', campoPrimary.length === 1, `found ${campoPrimary.length}`)

// 2. No Asignaciones as primary
const allPrimary = ROUTE_REGISTRY.filter((r) => r.navLevel === 'primary' && r.status === 'active')
check(
  'no-asignaciones-primary',
  !allPrimary.some((r) => r.path.includes('asignaciones')),
)

// 3. Every primary route has section
for (const r of allPrimary) {
  check(`primary-has-section:${r.path}`, Boolean(r.section))
}

// 4. Aliases documented
const aliases = ROUTE_REGISTRY.filter((r) => r.status === 'alias')
check('alias-operaciones-asignaciones', aliases.some((a) => a.path === '/operaciones/asignaciones'))
check('alias-situacion-nacional', aliases.some((a) => a.path === '/situacion-nacional'))

// 5. Router uses PermissionRoute guard helper
const routerSrc = readFileSync(resolve('src/app/router.tsx'), 'utf8')
check('router-guard-helper', routerSrc.includes('function guard('))
check('router-assignments-alias', routerSrc.includes('Navigate to="/misiones/asignaciones"'))

// 6. Sidebar uses navigation registry (not legacy NAV_SECTIONS inline)
const sidebarSrc = readFileSync(resolve('src/shared/layouts/Sidebar.tsx'), 'utf8')
check('sidebar-uses-registry', sidebarSrc.includes('navigation-registry'))
check('sidebar-no-campo-paquetes', !sidebarSrc.includes('Campo — Paquetes'))
check('sidebar-no-asignaciones-primary', !sidebarSrc.includes('Asignaciones'))

// 7. Forbidden terms in product UI surfaces
const uiFiles = [
  'src/shared/layouts/Sidebar.tsx',
  'src/modules/field-operations/pages/FieldCampoHomePage.tsx',
  'src/modules/field-operations/pages/FieldSyncPage.tsx',
  'src/modules/field-operations/pages/PendingEvidencePage.tsx',
  'src/modules/field-operations/field-mobile/components/FieldPilotBanner.tsx',
  'src/modules/missions/pages/MissionsPage.tsx',
]

for (const file of uiFiles) {
  const content = readFileSync(resolve(file), 'utf8')
  for (const term of FORBIDDEN_UI_TERMS) {
    check(`forbidden-term:${file}:${term}`, !content.toLowerCase().includes(term.toLowerCase()))
  }
  for (const code of findInternalPhaseCodes(content)) {
    check(`phase-code:${file}`, false, code)
  }
}

// 8. OperationalEmptyState exists and used
check(
  'operational-empty-state-component',
  readFileSync(resolve('src/shared/components/OperationalEmptyState.tsx'), 'utf8').includes('OperationalEmptyState'),
)
check(
  'missions-empty-state',
  readFileSync(resolve('src/modules/missions/pages/MissionsPage.tsx'), 'utf8').includes('OperationalEmptyState'),
)

// 9. Incident display name helper
check(
  'incident-display-name',
  readFileSync(resolve('src/modules/incidents/utils/incident-display-name.ts'), 'utf8').includes('buildIncidentDisplayName'),
)

// 10. Breadcrumbs component
check('breadcrumbs-component', readFileSync(resolve('src/shared/components/Breadcrumbs.tsx'), 'utf8').includes('Breadcrumbs'))

// 11. Campo secondary nav complete
check('campo-secondary-nav-count', CAMPO_SECONDARY_NAV.length === 6)

// 12. Registry routes with routeGuard appear protected in router
for (const r of ROUTE_REGISTRY.filter((x) => x.routeGuard && x.status === 'active')) {
  const perm = r.routeGuard!
  check(`route-guard-declared:${r.path}`, routerSrc.includes(`'${perm}'`))
}

console.log('\n=== product-navigation:audit ===')
console.log(`Checks passed: ${passes.length}`)
console.log(`Checks failed: ${failures.length}`)
if (failures.length > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  ✗ ${f}`)
  process.exit(1)
}
console.log('\nProduct Consolidation Phase 2 — Navigation & Role-Based Experience: audit OK')
