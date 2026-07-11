#!/usr/bin/env tsx
/**
 * runtime-console:audit — static gate for console/network anti-patterns in source.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { FORBIDDEN_UI_TERMS } from '@/shared/product-language'

const ROOT = process.cwd()
const failures: string[] = []
const passes: string[] = []

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) passes.push(name)
  else failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue
      walk(full, acc)
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      acc.push(full)
    }
  }
  return acc
}

const srcFiles = walk(resolve(ROOT, 'src'))
let consoleErrorCount = 0
let stackInUi = 0

for (const file of srcFiles) {
  const rel = file.replace(ROOT + '\\', '').replace(ROOT + '/', '')
  const src = readFileSync(file, 'utf8')
  if (/console\.error\(/.test(src) && !rel.includes('.test.')) consoleErrorCount++
  if (/stack trace/i.test(src) && rel.includes('pages/')) stackInUi++
}

check('scan:src-files', srcFiles.length > 100)
check('console-error:bounded', consoleErrorCount < 40, `${consoleErrorCount} files`)
check('ui:no-stack-traces', stackInUi === 0)

const authFetch = readFileSync(resolve(ROOT, 'src/core/auth/auth-fetch.ts'), 'utf8')
check('auth-fetch:401-handling', authFetch.includes('401') || authFetch.includes('refresh'))

const protectedRoute = readFileSync(resolve(ROOT, 'src/core/auth/ProtectedRoute.tsx'), 'utf8')
check('protected-route:exists', protectedRoute.includes('Navigate'))

const queryClient = readFileSync(resolve(ROOT, 'src/app/providers.tsx'), 'utf8')
check('query:refetchOnWindowFocus-off', queryClient.includes('refetchOnWindowFocus: false'))

const sidebar = readFileSync(resolve(ROOT, 'src/shared/layouts/Sidebar.tsx'), 'utf8')
check('sidebar:no-fixed-mobile-width', !sidebar.includes('w-56 md:hidden'))

for (const term of ['idempotency', 'internal_demo', '8C.2']) {
  if (sidebar.includes(term)) check(`forbidden:${term}`, false)
}

for (const term of FORBIDDEN_UI_TERMS.slice(0, 3)) {
  const re = new RegExp(term, 'i')
  if (re.test(readFileSync(resolve(ROOT, 'src/shared/layouts/AppShell.tsx'), 'utf8'))) {
    check(`shell:forbidden-${term}`, false)
  }
}

console.log(`\nruntime-console:audit — ${passes.length} passed, ${failures.length} failed\n`)
for (const p of passes) console.log(`  ✓ ${p}`)
for (const f of failures) console.log(`  ✗ ${f}`)

if (failures.length > 0) process.exit(1)
console.log('\nruntime-console:audit OK\n')
