import PDFDocument from 'pdfkit'
import type { InstitutionalReport } from '@/modules/institutional-reports/institutional-report.types'
import { formatReportGeneratedAt } from '@/modules/institutional-reports/report-period'
import { assertSafeExecutiveCopy } from '@/modules/executive-demo/copy-guard/executive-copy-guard'

function attachPageNumbers(doc: InstanceType<typeof PDFDocument>, report: InstitutionalReport) {
  const pages = doc.bufferedPageRange()
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i)
    doc
      .fontSize(8)
      .fillColor('#888')
      .text(
        `${report.classificationLabel} · ${report.id} · Página ${i + 1} de ${pages.count}`,
        50,
        doc.page.height - 40,
        { align: 'center', width: doc.page.width - 100 },
      )
  }
}

function ensureSpace(doc: InstanceType<typeof PDFDocument>, needed = 72) {
  if (doc.y + needed > doc.page.height - 60) {
    doc.addPage()
  }
}

function renderHeading(doc: InstanceType<typeof PDFDocument>, title: string) {
  ensureSpace(doc, 48)
  assertSafeExecutiveCopy(title)
  doc.fontSize(13).fillColor('#0d4f4f').text(title)
  doc.moveDown(0.35)
}

function renderParagraph(doc: InstanceType<typeof PDFDocument>, content: string) {
  assertSafeExecutiveCopy(content)
  doc.fontSize(10).fillColor('#333').text(content, { align: 'justify', lineGap: 2 })
  doc.moveDown(0.6)
}

function renderBullets(doc: InstanceType<typeof PDFDocument>, lines: string[]) {
  for (const line of lines) {
    ensureSpace(doc, 20)
    assertSafeExecutiveCopy(line)
    doc.fontSize(9).fillColor('#555').text(`• ${line}`)
  }
  doc.moveDown(0.5)
}

export async function renderInstitutionalReportPdf(report: InstitutionalReport): Promise<Buffer> {
  assertSafeExecutiveCopy(report.title)
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true })
    const chunks: Buffer[] = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.fontSize(10).fillColor('#555').text('TerraMind', { align: 'center' })
    doc.fontSize(18).fillColor('#0d4f4f').text(report.title, { align: 'center' })
    if (report.subtitle) {
      doc.fontSize(11).fillColor('#444').text(report.subtitle, { align: 'center' })
    }
    doc.moveDown(0.5)
    doc.fontSize(11).fillColor('#333').text(report.territory.label, { align: 'center' })
    doc.text(`Periodo analizado: ${report.period.label}`, { align: 'center' })
    doc.text(`Generado el ${formatReportGeneratedAt(report.generatedAt)}`, { align: 'center' })
    doc.moveDown(0.5)
    doc.fontSize(10).fillColor('#b45309').text(report.classificationLabel, { align: 'center' })
    if (report.watermark) {
      doc.text(report.watermark, { align: 'center' })
    }
    doc.moveDown(1)
    doc.fontSize(9).fillColor('#666').text(`Identificador: ${report.id} · Versión ${report.documentVersion}`, {
      align: 'center',
    })

    doc.addPage()

    renderHeading(doc, report.executiveSummary.title)
    renderParagraph(doc, report.executiveSummary.content)

    if (report.type === 'national' && report.metrics.length > 0) {
      renderHeading(doc, 'Indicadores nacionales')
      renderBullets(
        doc,
        report.metrics.map(
          (m) =>
            `${m.label}: ${m.value} (${m.timeWindow}) · ${m.breakdown.map((b) => `${b.label}: ${b.value}`).join(', ')}`,
        ),
      )
    }

    for (const map of report.maps) {
      renderHeading(doc, map.title)
      if (map.available) {
        renderParagraph(doc, `${map.territoryLabel} · ${map.periodLabel} · Fuente: ${map.source}`)
      } else {
        renderParagraph(doc, map.errorMessage ?? 'Mapa no disponible.')
        if (map.fallbackRows?.length) {
          renderBullets(doc, map.fallbackRows.map((r) => `${r.label}: ${r.detail}`))
        }
      }
    }

    if (report.findings.length > 0) {
      renderHeading(doc, 'Hallazgos prioritarios')
      renderBullets(
        doc,
        report.findings.map((f) => `${f.title} · ${f.location} · ${f.severity}`),
      )
    }

    if (report.incidents.length > 0) {
      renderHeading(doc, 'Incidentes operacionales')
      renderBullets(
        doc,
        report.incidents.map((i) => `${i.name} · ${i.lifecycle} · ${i.eventCount} evento(s)`),
      )
    } else if (report.type === 'national') {
      renderHeading(doc, 'Incidentes operacionales')
      renderParagraph(
        doc,
        'No se registraron incidentes operacionales pertenecientes a la organización durante el periodo.',
      )
    }

    if (report.legacyIncidents.length > 0) {
      renderHeading(doc, 'Incidentes legacy')
      renderBullets(doc, report.legacyIncidents.map((i) => `${i.name} · ${i.nextStep}`))
    }

    if (report.demoIncidents.length > 0) {
      renderHeading(doc, 'Demostración interna')
      renderBullets(doc, report.demoIncidents.map((i) => `${i.name} · No operacional`))
    }

    if (report.type === 'incident') {
      for (const section of report.sections.filter(
        (s) => !['identification', 'executive-summary'].includes(s.id),
      )) {
        renderHeading(doc, section.title)
        renderParagraph(doc, section.content)
      }
    }

    if (report.timeline.length > 0) {
      renderHeading(doc, 'Línea temporal')
      renderBullets(
        doc,
        report.timeline.slice(0, 20).map((t) => {
          const date = t.date ? new Date(t.date).toLocaleString('es-GT') : 's/f'
          return `${date} · ${t.stage}: ${t.event} (${t.epistemic})`
        }),
      )
    }

    renderHeading(doc, 'Metodología')
    renderParagraph(
      doc,
      [
        report.methodology.general,
        `Periodo: ${report.methodology.period}`,
        `Geografía: ${report.methodology.geography}`,
        `Filtrado: ${report.methodology.filtering}`,
        `Agrupación: ${report.methodology.eventGrouping}`,
        `Prioridad: ${report.methodology.priorityModel}`,
        `Versión: ${report.methodology.version}`,
      ].join('\n'),
    )

    renderHeading(doc, 'Limitaciones')
    renderBullets(doc, report.limitations)

    renderHeading(doc, 'Fuentes')
    renderBullets(
      doc,
      report.sources.map(
        (s) => `${s.name} (${s.type}) · ${s.coverage} · ${s.status} · ${s.limitation}`,
      ),
    )

    attachPageNumbers(doc, report)
    doc.end()
  })
}
