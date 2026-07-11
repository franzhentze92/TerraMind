import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = process.cwd()

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8')
}

describe('final hardening — layout and responsive', () => {
  it('sidebar uses mobile drawer not fixed 250px on mobile', () => {
    const sidebar = read('src/shared/layouts/Sidebar.tsx')
    expect(sidebar).toContain('fixed inset-0 z-50 md:hidden')
    expect(sidebar).not.toMatch(/w-\[250px\].*md:hidden/)
    expect(sidebar).toContain('hidden md:flex')
  })

  it('AppShell has mobile header and overflow guard', () => {
    const shell = read('src/shared/layouts/AppShell.tsx')
    expect(shell).toContain('MobileAppHeader')
    expect(shell).toContain('overflow-x-hidden')
    expect(shell).toContain('Suspense')
  })

  it('ErrorBoundary exists at app and shell level', () => {
    expect(read('src/shared/components/ErrorBoundary.tsx')).toContain('class ErrorBoundary')
    expect(read('src/app/providers.tsx')).toContain('ErrorBoundary')
    expect(read('src/shared/layouts/AppShell.tsx')).toContain('ErrorBoundary')
  })

  it('ResponsiveTable provides mobile card mode', () => {
    const table = read('src/shared/components/ResponsiveTable.tsx')
    expect(table).toContain('md:hidden')
    expect(table).toContain('hidden overflow-x-auto md:block')
  })

  it('population integration is deterministic; benchmark separated', () => {
    const integration = read('src/modules/territory/population/population.integration.test.ts')
    const benchmark = read('src/modules/territory/population/population.benchmark.test.ts')
    expect(integration).toContain('stable values after warm-up')
    expect(benchmark).toContain('median')
    expect(read('vitest.config.ts')).toContain('population.benchmark.test.ts')
  })

  it('router uses lazy loading for heavy modules', () => {
    const router = read('src/app/router.tsx')
    expect(router).toContain('lazy(')
    expect(router).toContain('NationalSituationPage')
  })

  it('global body prevents horizontal overflow', () => {
    expect(read('src/index.css')).toContain('overflow-x-hidden')
  })
})

describe('format-datetime-gt', () => {
  it('uses Guatemala timezone', async () => {
    const { formatDateTimeGt } = await import('@/shared/utils/format-datetime-gt')
    const formatted = formatDateTimeGt('2026-07-11T06:45:00.000Z')
    expect(formatted).toMatch(/2026/)
    expect(formatted).not.toMatch(/AM|PM/)
  })
})
