import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '@/shared/components/PageHeader'
import { useIncidentReport } from '../hooks/useExecutiveDemo'
import { IncidentStoryTimeline } from '../components/StoryTimeline'
import { DemoBanner } from '../components/ExecutiveDashboardPanels'
import { incidentReportPdfUrl } from '../api/executive-demo-api'
import { IntelligenceFlowSections } from '@/modules/intelligence-flow/components/IntelligenceFlowSections'

export function IncidentReportPage() {
  const { incidentId } = useParams()
  const query = useIncidentReport(incidentId, true)
  const report = query.data

  if (query.isLoading) {
    return <p className="p-6 text-sm text-text-tertiary">Generando informe…</p>
  }
  if (!report) {
    return <p className="p-6 text-sm text-confidence-low">Informe no disponible.</p>
  }

  return (
    <div className="executive-report overflow-y-auto p-4 md:p-8" data-testid="incident-report-page">
      <PageHeader
        title={report.title}
        subtitle={`Clasificación: ${report.classification}`}
        breadcrumbs={[
          { label: 'Situación Nacional', to: '/situacion' },
          { label: 'Informes', to: '/informes' },
          { label: report.title.slice(0, 48) },
        ]}
      />
      {report.story.is_internal_demo && <DemoBanner />}
      <IntelligenceFlowSections resourceType="incident" resourceId={incidentId} />
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <a
          href={incidentReportPdfUrl(incidentId!, true)}
          className="rounded bg-accent/20 px-3 py-1 text-xs text-accent"
        >
          Descargar PDF
        </a>
        <Link to={`/incidentes/${incidentId}/historia`} className="text-xs text-accent hover:underline">
          Ver historia
        </Link>
      </div>
      <p className="mb-6 text-sm text-text-secondary">{report.story.coverage.label}</p>

      {report.sections.map((s) => (
        <section key={s.id} className="mb-6">
          <h2 className="text-base font-medium">{s.title}</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">{s.content}</p>
        </section>
      ))}

      <div className="print:hidden">
        <h2 className="mb-4 text-base font-medium">Timeline visual</h2>
        <IncidentStoryTimeline stages={report.story.stages} />
      </div>
    </div>
  )
}
