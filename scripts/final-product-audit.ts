#!/usr/bin/env tsx
/**
 * final-product:audit — consolidates Product Consolidation gates (Phases 1–7).
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = process.cwd()
const failures: string[] = []
const passes: string[] = []

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) passes.push(name)
  else failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
}

function run(label: string, cmd: string): void {
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' })
    check(label, true)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    check(label, false, msg.slice(0, 200))
  }
}

const required = [
  'docs/product-consolidation/PHASE-7-FINAL-HARDENING-AUDIT.md',
  'docs/product-consolidation/PRODUCT-CONSOLIDATION-CLOSURE.md',
  'docs/product-consolidation/POST-CONSOLIDATION-BACKLOG.md',
  'src/shared/components/ErrorBoundary.tsx',
  'src/shared/components/ResponsiveTable.tsx',
  'src/shared/layouts/SidebarLayoutContext.tsx',
  'src/shared/final-hardening.test.ts',
  'scripts/final-product-audit.ts',
  'scripts/runtime-console-audit.ts',
]

for (const f of required) {
  check(`file:${f}`, existsSync(resolve(ROOT, f)))
}

const sidebar = readFileSync(resolve(ROOT, 'src/shared/layouts/Sidebar.tsx'), 'utf8')
check('mobile:drawer', sidebar.includes('fixed inset-0 z-50 md:hidden'))
check('mobile:no-permanent-sidebar', sidebar.includes('hidden md:flex'))

const router = readFileSync(resolve(ROOT, 'src/app/router.tsx'), 'utf8')
check('lazy:routes', router.includes('lazy('))

const populationTest = readFileSync(
  resolve(ROOT, 'src/modules/territory/population/population.integration.test.ts'),
  'utf8',
)
check('population:deterministic-integration', populationTest.includes('stable values after warm-up'))

run('build:tsc-vite', 'npm run build')
run('audit:product-truth', 'npm run product-truth:audit')
run('audit:product-navigation', 'npm run product-navigation:audit')
run('audit:national-situation', 'npm run national-situation:audit')
run('audit:intelligence-flow', 'npm run intelligence-flow:audit')
run('audit:operational-empty-states', 'npm run operational-empty-states:audit')
run('audit:professional-reports', 'npm run professional-reports:audit')
run('audit:executive-dashboard', 'npm run executive-dashboard:audit')
run('audit:runtime-console', 'npm run runtime-console:audit')
run('test:final-hardening', 'npx vitest run src/shared/final-hardening.test.ts')

console.log(`\nfinal-product:audit — ${passes.length} passed, ${failures.length} failed\n`)
for (const p of passes) console.log(`  ✓ ${p}`)
for (const f of failures) console.log(`  ✗ ${f}`)

if (failures.length > 0) {
  process.exit(1)
}

console.log('\nProduct Consolidation Phase 7 — Final Hardening audit OK\n')
