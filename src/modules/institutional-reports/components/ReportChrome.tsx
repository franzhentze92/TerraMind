import type { InstitutionalReport } from '../institutional-report.types'
import { formatReportGeneratedAt } from '../report-period'
import { REPORT_THEME } from '../report-theme'

export function ReportCover({ report }: { report: InstitutionalReport }) {
  return (
    <header className="institutional-report-cover page-break-after" data-testid="report-cover">
      {report.watermark && (
        <p className="institutional-report-watermark" aria-hidden>
          {report.watermark}
        </p>
      )}
      <p className="institutional-report-brand">{REPORT_THEME.brand}</p>
      <h1 className="institutional-report-title">{report.title}</h1>
      {report.subtitle && <p className="institutional-report-subtitle">{report.subtitle}</p>}
      <div className="institutional-report-cover-meta">
        <p>{report.territory.label}</p>
        <p>Periodo analizado: {report.period.label}</p>
        <p>Generado el {formatReportGeneratedAt(report.generatedAt)}</p>
        <p className="institutional-report-classification">{report.classificationLabel}</p>
        {report.organization && <p>Organización: {report.organization}</p>}
        <p className="text-xs text-text-tertiary">
          ID: {report.id} · Versión {report.documentVersion}
        </p>
      </div>
    </header>
  )
}

export function ReportHeader({ report }: { report: InstitutionalReport }) {
  return (
    <div className="institutional-report-header print-only" aria-hidden>
      <span>{report.title}</span>
      <span>{report.classificationLabel}</span>
    </div>
  )
}

export function ReportFooter({ report }: { report: InstitutionalReport }) {
  return (
    <footer className="institutional-report-footer">
      <span>{REPORT_THEME.brand} · {report.id}</span>
      <span>{formatReportGeneratedAt(report.generatedAt)}</span>
      <span>{report.classificationLabel}</span>
    </footer>
  )
}
