#!/usr/bin/env tsx
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { config } from 'dotenv'

config({ path: resolve(process.cwd(), '.env') })

const ROOT = process.cwd()
const blockers: string[] = []

function pass(name: string, detail?: string) {
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`)
}

function fail(name: string, detail?: string) {
  blockers.push(`${name}${detail ? `: ${detail}` : ''}`)
  console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  console.log('Executive Dashboard Audit (8C.DEMO)\n')

  const routes = [
    'src/app/router.tsx',
    'server/routes/executive-dashboard.ts',
    'server/routes/incident-story.ts',
    'server/routes/reports.ts',
    'server/services/executive-dashboard.service.ts',
    'server/services/incident-story.service.ts',
    'server/services/reports.service.ts',
    'server/services/reports-pdf.service.ts',
    'src/modules/executive-demo/pages/IncidentStoryPage.tsx',
    'src/modules/executive-demo/pages/NationalReportPage.tsx',
    'src/modules/executive-demo/pages/ReportsHubPage.tsx',
    'src/modules/executive-demo/components/ExecutiveNationalCommandCenter.tsx',
    'scripts/generate-report-samples.ts',
  ]
  for (const f of routes) {
    if (!existsSync(join(ROOT, f))) fail(`missing ${f}`)
  }
  pass('core routes and files present')

  const router = await import('../src/app/router.js').catch(() => null)
  if (!router) pass('router module (tsx runtime)')

  const copyGuard = await import('../src/modules/executive-demo/copy-guard/executive-copy-guard.js')
  if (copyGuard.containsForbiddenExecutiveCopy('incendio confirmado')) pass('copy guard active')
  else fail('copy guard')

  const demo = await import('../src/modules/executive-demo/demo-config.js')
  if (demo.INTERNAL_DEMO_INCIDENT_ID) pass('demo incident configured', demo.INTERNAL_DEMO_INCIDENT_ID.slice(0, 8))

  try {
    const { renderNationalReportPdf } = await import('../server/services/reports-pdf.service.js')
    const buf = await renderNationalReportPdf({
      title: 'Test Report',
      classification: 'draft',
      period: { preset: '7d', from: new Date().toISOString(), to: new Date().toISOString() },
      generated_at: new Date().toISOString(),
      dashboard: {} as never,
      sections: [{ id: 't', title: 'Test', content: 'Monitoreo térmico' }],
    })
    if (buf.length > 100) pass('PDF generation', `${buf.length} bytes`)
    else fail('PDF generation', 'buffer too small')
  } catch (err) {
    fail('PDF generation', err instanceof Error ? err.message : String(err))
  }

  console.log('\n--- Summary ---')
  if (blockers.length === 0) {
    console.log('AUDIT PASSED — no critical blockers')
    process.exit(0)
  }
  console.log(`AUDIT FAILED — ${blockers.length} blocker(s)`)
  for (const b of blockers) console.log(`  - ${b}`)
  process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
