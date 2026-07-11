import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FORBIDDEN_UI_TERMS } from '@/shared/product-language'

describe('OperationalEmptyState contract', () => {
  it('supports status and action props', () => {
    const src = readFileSync(resolve('src/shared/components/OperationalEmptyState.tsx'), 'utf8')
    expect(src).toContain('OperationalEmptyStatus')
    expect(src).toContain('primaryAction')
    expect(src).toContain('supplementalNote')
    expect(src).toContain('data-empty-status')
  })

  it('FilterEmptyState clears filters messaging', () => {
    const src = readFileSync(resolve('src/shared/components/OperationalEmptyState.tsx'), 'utf8')
    expect(src).toContain('FilterEmptyState')
    expect(src).toContain('Limpiar filtros')
  })
})

describe('field experience empty states', () => {
  const fieldPages = [
    'src/modules/field-operations/pages/FieldCampoHomePage.tsx',
    'src/modules/field-operations/pages/FieldPackagesPage.tsx',
    'src/modules/field-operations/pages/PendingEvidencePage.tsx',
    'src/modules/field-operations/pages/FieldSyncPage.tsx',
    'src/modules/field-operations/pages/FieldConflictsPage.tsx',
  ]

  for (const page of fieldPages) {
    it(`${page} uses OperationalEmptyState`, () => {
      const src = readFileSync(resolve(page), 'utf8')
      expect(src).toContain('OperationalEmptyState')
      expect(src).not.toMatch(/Sin registros/i)
    })
  }

  it('FieldConflictsPage removes fixture demo section', () => {
    const src = readFileSync(resolve('src/modules/field-operations/pages/FieldConflictsPage.tsx'), 'utf8')
    expect(src).not.toContain('Fixtures de conflicto')
    expect(src).not.toContain('simulados')
  })

  it('PendingEvidencePage avoids FIELD_REAL_SYNC_ENABLED in visible copy', () => {
    const src = readFileSync(resolve('src/modules/field-operations/pages/PendingEvidencePage.tsx'), 'utf8')
    expect(src).not.toContain('FIELD_REAL_SYNC_ENABLED')
    expect(src).toContain('sincronización todavía no está habilitada')
  })
})

describe('missions empty states', () => {
  it('MissionsPage separates demo note', () => {
    const src = readFileSync(resolve('src/modules/missions/pages/MissionsPage.tsx'), 'utf8')
    expect(src).toContain('useCanonicalOperationalCounts')
    expect(src).toContain('demostración interna')
    expect(src).toContain('OperationalListSkeleton')
  })

  it('assignments panel explains origin', () => {
    const src = readFileSync(resolve('src/modules/missions/components/MissionsAssignmentsPanel.tsx'), 'utf8')
    expect(src).toContain('No hay asignaciones pendientes')
  })
})

describe('filter vs system empty', () => {
  it('FindingsPage uses FilterEmptyState', () => {
    const src = readFileSync(resolve('src/modules/findings/pages/FindingsPage.tsx'), 'utf8')
    expect(src).toContain('FilterEmptyState')
    expect(src).toContain('hasActiveFilters')
  })

  it('PrioritiesPage distinguishes filter empty', () => {
    const src = readFileSync(resolve('src/modules/priorities/pages/PrioritiesPage.tsx'), 'utf8')
    expect(src).toContain('FilterEmptyState')
  })
})

describe('canonical counts hook', () => {
  it('reads executive metrics ids', () => {
    const src = readFileSync(resolve('src/shared/hooks/useCanonicalOperationalCounts.ts'), 'utf8')
    expect(src).toContain('missions_operational')
    expect(src).toContain('incidents_legacy')
    expect(src).toContain('useExecutiveMetrics')
  })
})

describe('forbidden language on updated pages', () => {
  const pages = [
    'src/modules/field-operations/pages/FieldCampoHomePage.tsx',
    'src/modules/executive-demo/pages/ReportsHubPage.tsx',
    'src/modules/response-orchestration/pages/ResponseOrchestrationListPage.tsx',
  ]

  for (const page of pages) {
    it(`${page} avoids forbidden terms`, () => {
      const src = readFileSync(resolve(page), 'utf8')
      for (const term of FORBIDDEN_UI_TERMS) {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        expect(new RegExp(`(?<![.\\w])${escaped}`, 'i').test(src)).toBe(false)
      }
    })
  }
})

describe('loading before empty', () => {
  it('MissionsPage shows skeleton while loading', () => {
    const src = readFileSync(resolve('src/modules/missions/pages/MissionsPage.tsx'), 'utf8')
    expect(src).toContain('query.isLoading && <OperationalListSkeleton')
    expect(src).toMatch(/listEmpty.*query\.isLoading/s)
  })
})
