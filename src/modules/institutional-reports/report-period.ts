import type { ReportPeriod } from '@/modules/executive-demo/types/executive-demo.types'

const GUATEMALA_TZ = 'America/Guatemala'

export function formatReportPeriodLabel(period: ReportPeriod): string {
  const from = new Date(period.from)
  const to = new Date(period.to)
  const fmt = new Intl.DateTimeFormat('es-GT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: GUATEMALA_TZ,
  })
  return `${fmt.format(from)} – ${fmt.format(to)}`
}

export function formatReportGeneratedAt(iso: string): string {
  return new Intl.DateTimeFormat('es-GT', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: GUATEMALA_TZ,
  }).format(new Date(iso))
}

export function reportPeriodMeta(period: ReportPeriod) {
  return {
    from: period.from,
    to: period.to,
    label: formatReportPeriodLabel(period),
    timezone: GUATEMALA_TZ,
  }
}
