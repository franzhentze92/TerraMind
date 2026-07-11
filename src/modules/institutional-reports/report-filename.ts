import type { InstitutionalReportClassification, InstitutionalReportType } from './institutional-report.types'

const CLASS_SLUG: Record<InstitutionalReportClassification, string> = {
  draft: 'borrador',
  internal: 'uso_interno',
  official: 'oficial',
  demo: 'demostracion',
}

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48)
}

export function institutionalReportFilename(
  type: InstitutionalReportType,
  classification: InstitutionalReportClassification,
  opts: {
    periodFrom?: string
    periodTo?: string
    incidentSlug?: string
    generatedAt?: string
    extension?: 'pdf' | 'html'
  } = {},
): string {
  const ext = opts.extension ?? 'pdf'
  const classPart = CLASS_SLUG[classification]
  const datePart = (opts.generatedAt ?? new Date().toISOString()).slice(0, 10)

  if (type === 'national') {
    const from = (opts.periodFrom ?? '').slice(0, 10)
    const to = (opts.periodTo ?? '').slice(0, 10)
    return `terramind_informe_nacional_${from}_${to}_${classPart}.${ext}`
  }

  const slug = slugify(opts.incidentSlug ?? 'incidente')
  return `terramind_incidente_${slug}_${datePart}_${classPart}.${ext}`
}
