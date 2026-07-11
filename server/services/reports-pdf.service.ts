import PDFDocument from 'pdfkit'
import type { IncidentReportDto, NationalReportDto, ReportClassification } from '@/modules/executive-demo/types/executive-demo.types'
import { assertSafeExecutiveCopy } from '@/modules/executive-demo/copy-guard/executive-copy-guard'
import { renderInstitutionalReportPdf } from './institutional-report-pdf.service.js'

function classificationLabel(c: ReportClassification): string {
  const map: Record<ReportClassification, string> = {
    internal_use: 'Uso interno',
    draft: 'Borrador',
    verified: 'Verificado',
    internal_demo: 'Demostración interna',
  }
  return map[c]
}

function attachPageNumbers(doc: InstanceType<typeof PDFDocument>) {
  const pages = doc.bufferedPageRange()
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i)
    doc.fontSize(8).fillColor('#888').text(
      `TerraMind — Inteligencia Ambiental · Página ${i + 1} de ${pages.count}`,
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

function renderSection(
  doc: InstanceType<typeof PDFDocument>,
  title: string,
  content: string,
  extras?: string[],
) {
  ensureSpace(doc, 80)
  assertSafeExecutiveCopy(title)
  assertSafeExecutiveCopy(content)
  doc.fontSize(13).fillColor('#0d4f4f').text(title)
  doc.moveDown(0.25)
  doc.fontSize(10).fillColor('#333').text(content, { align: 'justify', lineGap: 2 })
  if (extras?.length) {
    doc.moveDown(0.3)
    for (const line of extras) {
      ensureSpace(doc, 24)
      doc.fontSize(9).fillColor('#555').text(`• ${line}`)
    }
  }
  doc.moveDown(0.8)
}

export async function renderNationalReportPdf(report: NationalReportDto): Promise<Buffer> {
  if (report.institutional) {
    return renderInstitutionalReportPdf(report.institutional)
  }
  assertSafeExecutiveCopy(report.title)
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true })
    const chunks: Buffer[] = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.fontSize(22).fillColor('#0d4f4f').text('TerraMind', { align: 'center' })
    doc.fontSize(14).fillColor('#333').text('Inteligencia Ambiental · Guatemala', { align: 'center' })
    doc.moveDown(1)
    doc.fontSize(16).fillColor('#111').text(report.title, { align: 'center' })
    doc.moveDown(0.5)
    doc.fontSize(11).fillColor('#444').text(`Clasificación: ${classificationLabel(report.classification)}`, {
      align: 'center',
    })
    doc.text(`Período: ${report.period.preset} (${report.period.from.slice(0, 10)} — ${report.period.to.slice(0, 10)})`, {
      align: 'center',
    })
    doc.text(`Generado: ${new Date(report.generated_at).toLocaleString('es-GT')}`, { align: 'center' })
    doc.moveDown(1.5)
    doc.fontSize(10).fillColor('#666').text(
      'Documento determinístico agregado desde motores TerraMind. No confirma emergencias ni daños.',
      { align: 'center' },
    )

    doc.addPage()
    const summary = report.dashboard?.summary
    renderSection(doc, 'Resumen ejecutivo', [
      summary?.what_is_happening ?? 'Sin resumen disponible.',
      summary?.requires_attention ?? '',
      summary?.terramind_recommends ?? '',
    ]
      .filter(Boolean)
      .join('\n\n'))

    // Canonical metrics (Product Consolidation — Phase 1): the PDF prints the
    // same numbers as the dashboard/report so figures can never diverge.
    const metrics = report.canonical_metrics ?? []
    const metricLines = metrics.map((m) => {
      const excluded = m.breakdown
        .filter((b) => !b.included && b.value > 0)
        .map((b) => `${b.label}: ${b.value}`)
      const suffix = excluded.length > 0 ? ` (${excluded.join(' · ')})` : ''
      return `${m.label} [${m.timeWindow.label}]: ${m.value}${suffix}`
    })
    renderSection(doc, 'Indicadores nacionales', 'Conteos canónicos con clasificación operacional / legacy / demo.', metricLines)

    renderSection(
      doc,
      'Hallazgos prioritarios',
      `${report.dashboard?.priority_findings?.length ?? 0} hallazgo(s) destacados`,
      (report.dashboard?.priority_findings ?? []).slice(0, 8).map((f) => `${f.title} (${f.severity_label})`),
    )

    renderSection(
      doc,
      'Incidentes activos',
      `${report.dashboard?.active_incidents?.length ?? 0} incidente(s) en vista`,
      (report.dashboard?.active_incidents ?? [])
        .slice(0, 8)
        .map((i) => `${i.id.slice(0, 8)}… · ${i.status} · ${i.story_coverage}`),
    )

    renderSection(
      doc,
      'Cambios recientes',
      `${report.dashboard?.recent_changes?.length ?? 0} evento(s) en timeline nacional`,
      (report.dashboard?.recent_changes ?? []).slice(0, 10).map((e) => `${e.stage_label}: ${e.summary}`),
    )

    renderSection(
      doc,
      'Verificaciones y misiones',
      `${report.dashboard?.pending_verifications?.length ?? 0} plan(es) · ${report.dashboard?.missions_in_progress?.length ?? 0} misión(es)`,
      (report.dashboard?.missions_in_progress ?? []).map(
        (m) => `${m.title} (${m.status})${m.is_internal_demo ? ' [demo]' : ''}`,
      ),
    )

    renderSection(
      doc,
      'Evidencia, resoluciones y respuesta',
      [
        `Evidencia reciente: ${report.dashboard?.recent_evidence?.length ?? 0}`,
        `Resoluciones: ${report.dashboard?.recent_resolutions?.length ?? 0}`,
        `Assessments: ${report.dashboard?.response_recommendations?.length ?? 0}`,
        `Decisiones pendientes: ${report.dashboard?.pending_decisions?.length ?? 0}`,
      ].join(' · '),
      (report.dashboard?.empty_sections ?? []).slice(0, 4).map((s) => `${s.title}: ${s.why_empty}`),
    )

    renderSection(
      doc,
      'Auditoría de datos',
      'Estado por etapa del pipeline nacional',
      (report.dashboard?.data_audit ?? []).map((a) => `${a.stage}: ${a.count} (${a.status})`),
    )

    for (const section of report.sections.filter((s) => !['cover', 'executive'].includes(s.id))) {
      renderSection(doc, section.title, section.content)
    }

    renderSection(
      doc,
      'Limitaciones',
      report.sections.find((s) => s.id === 'limitations')?.content ??
        'Los niveles de confianza se reportan por etapa; no se confirman causas ni daños.',
    )

    attachPageNumbers(doc)
    doc.end()
  })
}

export async function renderIncidentReportPdf(report: IncidentReportDto): Promise<Buffer> {
  if (report.institutional) {
    return renderInstitutionalReportPdf(report.institutional)
  }
  assertSafeExecutiveCopy(report.title)
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true })
    const chunks: Buffer[] = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.fontSize(22).fillColor('#0d4f4f').text('TerraMind', { align: 'center' })
    doc.moveDown(0.5)
    doc.fontSize(14).text(report.title, { align: 'center' })
    doc.fontSize(10).fillColor('#444').text(`Clasificación: ${classificationLabel(report.classification)}`, {
      align: 'center',
    })
    doc.text(`Incidente: ${report.incident_id}`, { align: 'center' })
    doc.text(report.story.coverage.label, { align: 'center' })
    if (report.story.coverage.missing_stage_labels.length > 0) {
      doc.text(`Etapas faltantes: ${report.story.coverage.missing_stage_labels.join(', ')}`, {
        align: 'center',
      })
    }
    if (report.story.is_internal_demo) {
      doc.fillColor('#b45309').text('Demostración interna — no representa un evento ambiental confirmado', {
        align: 'center',
      })
    }

    doc.addPage()
    for (const stage of report.story.stages) {
      renderSection(
        doc,
        `${stage.order}. ${stage.title}`,
        stage.summary + (stage.detail ? `\n\n${stage.detail}` : ''),
        [
          `Estado: ${stage.status}`,
          `Epistémico: ${stage.epistemic}`,
          stage.timestamp ? `Timestamp: ${stage.timestamp}` : 'Sin timestamp',
        ].filter(Boolean),
      )
    }

    renderSection(
      doc,
      'Timeline del incidente',
      `${report.story.timeline.length} entrada(s) cronológicas`,
      report.story.timeline.slice(0, 12).map((t) => `${t.stage_label}: ${t.summary}`),
    )

    attachPageNumbers(doc)
    doc.end()
  })
}
