#!/usr/bin/env tsx
/**
 * professional-reports:audit — Product Consolidation Phase 6 gate.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { canMarkOfficial, classificationBanner } from '@/modules/institutional-reports/report-classification'
import { institutionalReportFilename } from '@/modules/institutional-reports/report-filename'
import { FORBIDDEN_UI_TERMS } from '@/shared/product-language'

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
  'docs/product-consolidation/PHASE-6-REPORTS-AUDIT.md',
  'src/modules/institutional-reports/institutional-report.types.ts',
  'src/modules/institutional-reports/report-classification.ts',
  'src/modules/institutional-reports/report-filename.ts',
  'src/modules/institutional-reports/report-theme.ts',
  'src/modules/institutional-reports/report-print.css',
  'src/modules/institutional-reports/builders/national-report.builder.ts',
  'src/modules/institutional-reports/builders/incident-report.builder.ts',
  'src/modules/institutional-reports/components/ReportChrome.tsx',
  'src/modules/institutional-reports/components/ReportSection.tsx',
  'src/modules/institutional-reports/components/ReportTable.tsx',
  'src/modules/institutional-reports/components/InstitutionalReportView.tsx',
  'src/modules/institutional-reports/institutional-reports.test.ts',
  'server/services/institutional-report-pdf.service.ts',
  'scripts/professional-reports-audit.ts',
]

for (const f of requiredFiles) {
  check(`file:${f}`, existsSync(resolve(ROOT, f)))
}

const typesSrc = read('src/modules/institutional-reports/institutional-report.types.ts')
check('model:InstitutionalReport', typesSrc.includes('interface InstitutionalReport'))
check('model:methodology', typesSrc.includes('methodology: ReportMethodology'))
check('model:limitations', typesSrc.includes('limitations: string[]'))
check('model:sources', typesSrc.includes('sources: ReportSource[]'))

const nationalBuilder = read('src/modules/institutional-reports/builders/national-report.builder.ts')
check('national:ExecutiveMetrics', nationalBuilder.includes('canonical_metrics'))
check('national:no-empty-incidents-table', nationalBuilder.includes('operationalIncidents'))
check('national:legacy-separated', nationalBuilder.includes('legacyIncidents'))

const incidentBuilder = read('src/modules/institutional-reports/builders/incident-report.builder.ts')
check('incident:stages', incidentBuilder.includes('story.stages'))
check('incident:timeline', incidentBuilder.includes('story.timeline'))

const reportsService = read('server/services/reports.service.ts')
check('service:institutional-attached', reportsService.includes('report.institutional = buildNationalInstitutionalReport'))
check('service:spanish-title', reportsService.includes('Informe Nacional de Inteligencia Ambiental'))
check('service:no-english-title', !reportsService.includes('National Environmental Intelligence Report'))

const pdfService = read('server/services/reports-pdf.service.ts')
check('pdf:institutional-branch', pdfService.includes('if (report.institutional)'))

const routes = read('server/routes/reports.ts')
check('routes:institutional-filename', routes.includes('institutionalReportFilename'))

const nationalPage = read('src/modules/executive-demo/pages/NationalReportPage.tsx')
check('html:InstitutionalReportView', nationalPage.includes('InstitutionalReportView'))
check('html:no-raw-classification', !nationalPage.includes('report.classification}'))

const printCss = read('src/modules/institutional-reports/report-print.css')
check('print:@page', printCss.includes('@page'))
check('print:a4', printCss.includes('210mm'))

const filename = institutionalReportFilename('national', 'draft', {
  periodFrom: '2026-07-04',
  periodTo: '2026-07-10',
})
check('filename:no-spaces', !filename.includes(' '))
check('filename:classification', filename.includes('borrador'))
check('filename:no-full-uuid', !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(filename))

check(
  'classification:demo-never-official',
  !canMarkOfficial({
    classification: 'demo',
    includeDemo: true,
    hasLegacyAsOperational: false,
    hasPeriod: true,
    hasSources: true,
    hasMethodology: true,
    hasIncompleteCriticalSections: false,
    hasAssessmentWhenRecommending: true,
  }),
)

check('classification:banner-spanish', classificationBanner('draft') === 'BORRADOR · USO INTERNO')

const viewSrc = read('src/modules/institutional-reports/components/InstitutionalReportView.tsx')
check('view:methodology-section', viewSrc.includes("'Metodología'"))
check('view:limitations-section', viewSrc.includes("'Limitaciones'"))
check('view:empty-incidents-message', viewSrc.includes('No se registraron incidentes operacionales'))

for (const term of ['internal_demo', 'idempotency', '8C.2', '8A–8C']) {
  if (nationalPage.includes(term) || viewSrc.includes(term)) {
    check(`forbidden-term:${term}`, false)
  }
}

for (const term of FORBIDDEN_UI_TERMS.slice(0, 5)) {
  if (viewSrc.toLowerCase().includes(term.toLowerCase())) {
    check(`forbidden-ui:${term}`, false)
  }
}

console.log(`\nprofessional-reports:audit — ${passes.length} passed, ${failures.length} failed\n`)
for (const p of passes) console.log(`  ✓ ${p}`)
for (const f of failures) console.log(`  ✗ ${f}`)

if (failures.length > 0) {
  process.exit(1)
}

console.log('\nProduct Consolidation Phase 6 — Professional Reports audit OK\n')
