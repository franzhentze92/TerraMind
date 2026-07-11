#!/usr/bin/env tsx
/**
 * Generate sanitized report samples for 8C.DEMO visual review.
 * Output: artifacts/reports/8C.DEMO/
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { config } from 'dotenv'

config({ path: resolve(process.cwd(), '.env') })

const OUT = join(process.cwd(), 'artifacts', 'reports', '8C.DEMO')
const DEMO_INCIDENT = '8cd9487a-6823-43d6-b186-3166165db05a'

async function main() {
  mkdirSync(OUT, { recursive: true })

  const { getIncidentStory } = await import('../server/services/incident-story.service.js')
  const { buildNationalReport, buildIncidentReport } = await import('../server/services/reports.service.js')
  const { renderNationalReportPdf, renderIncidentReportPdf } = await import(
    '../server/services/reports-pdf.service.js'
  )

  const mockAuth = {
    authUserId: 'sample',
    userId: 'sample',
    activeOrganizationId: '3d641b07-1366-4baf-aecd-a5511c68fa69',
    membershipId: 'sample',
    roles: ['platform_admin'] as const,
    permissions: ['findings.view', 'incidents.view', 'responses.view'] as const,
    isPlatformAdmin: true,
  }

  const period = {
    preset: '7d' as const,
    from: new Date(Date.now() - 7 * 86400000).toISOString(),
    to: new Date().toISOString(),
  }

  const national = await buildNationalReport(mockAuth as never, period, true)
  writeFileSync(join(OUT, 'national-report.json'), JSON.stringify(national, null, 2))
  writeFileSync(
    join(OUT, 'national-report.html'),
    renderHtmlReport(national.title, national.sections, national.classification),
  )
  const nationalPdf = await renderNationalReportPdf(national)
  writeFileSync(join(OUT, 'national-report.pdf'), nationalPdf)

  const story = await getIncidentStory(DEMO_INCIDENT, { include_demo: true })
  if (story) {
    writeFileSync(join(OUT, 'incident-story.json'), JSON.stringify(story, null, 2))
  }

  const incidentReport = await buildIncidentReport(mockAuth as never, DEMO_INCIDENT, true)
  if (incidentReport) {
    writeFileSync(join(OUT, 'incident-report.json'), JSON.stringify(incidentReport, null, 2))
    writeFileSync(
      join(OUT, 'incident-report.html'),
      renderHtmlReport(incidentReport.title, incidentReport.sections, incidentReport.classification),
    )
    const incidentPdf = await renderIncidentReportPdf(incidentReport)
    writeFileSync(join(OUT, `incident-${DEMO_INCIDENT.slice(0, 8)}.pdf`), incidentPdf)
  }

  console.log(`Samples written to ${OUT}`)
}

function renderHtmlReport(
  title: string,
  sections: Array<{ id: string; title: string; content: string }>,
  classification: string,
): string {
  const body = sections
    .map(
      (s) =>
        `<section><h2>${escapeHtml(s.title)}</h2><p>${escapeHtml(s.content).replace(/\n/g, '<br/>')}</p></section>`,
    )
    .join('\n')
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui;max-width:800px;margin:2rem auto;padding:0 1rem;line-height:1.5}
header{border-bottom:1px solid #ccc;padding-bottom:1rem}section{margin:1.5rem 0}h1{font-size:1.5rem}h2{font-size:1.1rem;color:#0d4f4f}
.classification{font-size:.85rem;color:#666}</style></head><body>
<header><p class="classification">TerraMind · ${escapeHtml(classification)}</p><h1>${escapeHtml(title)}</h1></header>
${body}
<footer><p><small>Fuentes: NASA FIRMS, motores TerraMind. Uso interno.</small></p></footer>
</body></html>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
