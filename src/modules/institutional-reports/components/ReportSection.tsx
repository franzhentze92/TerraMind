import type { ReportSection as ReportSectionType } from '../institutional-report.types'

export function ReportSection({ section }: { section: ReportSectionType }) {
  return (
    <section className="institutional-report-section break-inside-avoid" id={section.id}>
      <h2 className="institutional-report-section-title">
        {section.title}
        {section.status && section.status !== 'available' && (
          <span className="institutional-report-section-badge">{statusLabel(section.status)}</span>
        )}
      </h2>
      <div className="institutional-report-section-body whitespace-pre-wrap">{section.content}</div>
      {section.items && section.items.length > 0 && (
        <ul className="institutional-report-list">
          {section.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

function statusLabel(status: NonNullable<ReportSectionType['status']>): string {
  const map: Record<NonNullable<ReportSectionType['status']>, string> = {
    available: 'Disponible',
    pending: 'Pendiente',
    not_required: 'No requerida',
    legacy: 'Legacy',
    demo: 'Demo',
    unavailable: 'No disponible',
  }
  return map[status]
}

export function ReportCallout({
  title,
  children,
  variant = 'info',
}: {
  title: string
  children: React.ReactNode
  variant?: 'info' | 'warning' | 'demo'
}) {
  return (
    <aside className={`institutional-report-callout institutional-report-callout--${variant}`}>
      <p className="font-medium">{title}</p>
      <div className="mt-1 text-sm">{children}</div>
    </aside>
  )
}
