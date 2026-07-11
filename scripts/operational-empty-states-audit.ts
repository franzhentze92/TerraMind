#!/usr/bin/env tsx
/**
 * operational-empty-states:audit — Product Consolidation Phase 5 gate.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { FORBIDDEN_UI_TERMS, findInternalPhaseCodes } from '@/shared/product-language'

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
  'docs/product-consolidation/PHASE-5-EMPTY-STATES-AUDIT.md',
  'src/shared/components/OperationalEmptyState.tsx',
  'src/shared/components/OperationalErrorState.tsx',
  'src/shared/components/OperationalLoadingSkeleton.tsx',
  'src/shared/hooks/useCanonicalOperationalCounts.ts',
  'src/shared/operational-empty-states.test.ts',
  'scripts/operational-empty-states-audit.ts',
]

for (const f of requiredFiles) {
  check(`file:${f}`, existsSync(resolve(ROOT, f)))
}

const emptyStateSrc = read('src/shared/components/OperationalEmptyState.tsx')
check('empty-state:status-prop', emptyStateSrc.includes('OperationalEmptyStatus'))
check('empty-state:source-process', emptyStateSrc.includes('sourceProcess'))
check('empty-state:filter-helper', emptyStateSrc.includes('FilterEmptyState'))
check('empty-state:permission-denied', emptyStateSrc.includes('PermissionDeniedState'))

const errorSrc = read('src/shared/components/OperationalErrorState.tsx')
check('error-state:retry', errorSrc.includes('onRetry'))
check('error-state:no-stack-in-main', !errorSrc.includes('stack trace'))

const fieldPages = [
  'src/modules/field-operations/pages/FieldCampoHomePage.tsx',
  'src/modules/field-operations/pages/FieldPackagesPage.tsx',
  'src/modules/field-operations/pages/PendingEvidencePage.tsx',
  'src/modules/field-operations/pages/FieldSyncPage.tsx',
  'src/modules/field-operations/pages/FieldConflictsPage.tsx',
]

for (const page of fieldPages) {
  const src = read(page)
  check(`${page}:operational-empty`, src.includes('OperationalEmptyState'))
  check(`${page}:no-solo-registros`, !/>\s*Sin registros\s*</i.test(src))
  if (src.match(/Sin registros/i) && !src.includes('FilterEmptyState')) {
    check(`${page}:sin-registros-only`, false)
  }
  for (const term of ['allowlist', 'mock transport', 'Sync simulado', 'fixture sintético', '8B.7G']) {
    if (src.toLowerCase().includes(term.toLowerCase())) {
      check(`${page}:forbidden`, false, term)
    }
  }
}

check('conflicts:no-fixture-section', !read('src/modules/field-operations/pages/FieldConflictsPage.tsx').includes('Fixtures de conflicto'))

const listPages = [
  'src/modules/missions/pages/MissionsPage.tsx',
  'src/modules/findings/pages/FindingsPage.tsx',
  'src/modules/priorities/pages/PrioritiesPage.tsx',
  'src/modules/incidents/pages/IncidentsPage.tsx',
  'src/modules/verification/pages/VerificationsPage.tsx',
]

for (const page of listPages) {
  const src = read(page)
  check(`${page}:skeleton`, src.includes('OperationalListSkeleton') || src.includes('OperationalCardSkeleton'))
  check(`${page}:empty-state`, src.includes('OperationalEmptyState') || src.includes('FilterEmptyState'))
  const phaseCodes = findInternalPhaseCodes(src)
  check(`${page}:no-phase-codes`, phaseCodes.length === 0, phaseCodes.join(', '))
}

check('missions:canonical-counts', read('src/modules/missions/pages/MissionsPage.tsx').includes('useCanonicalOperationalCounts'))
check('incidents:legacy-note', read('src/modules/incidents/pages/IncidentsPage.tsx').includes('incidentsLegacy'))
check('resolution:empty-state', read('src/modules/verification/components/IncidentVerificationResolutionSection.tsx').includes('Aún no existe una resolución'))

const forbiddenOnlyInUi = FORBIDDEN_UI_TERMS.filter((t) =>
  ['tenant-owned', 'ready_for_validation', 'pending sync', 'allowlist'].includes(t),
)

for (const page of fieldPages) {
  const src = read(page)
  for (const term of forbiddenOnlyInUi) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`(?<![.\\w])${escaped}`, 'i').test(src)) {
      check(`${page}:forbidden-ui`, false, term)
    }
  }
}

console.log('\n=== operational-empty-states:audit ===')
console.log(`Passed: ${passes.length}`)
console.log(`Failed: ${failures.length}`)
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`)
  process.exit(1)
}
console.log('AUDIT PASSED')
process.exit(0)
