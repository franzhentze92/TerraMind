import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { OperationalDetailSkeleton } from '@/shared/components'
import { PageHeader } from '@/shared/components/PageHeader'
import { InstitutionalReportView } from '@/modules/institutional-reports/components/InstitutionalReportView'
import { classificationBanner } from '@/modules/institutional-reports/report-classification'
import { fromLegacyReportClassification } from '@/modules/institutional-reports/report-classification'
import { useIncidentReport } from '../hooks/useExecutiveDemo'
import { IncidentStoryTimeline } from '../components/StoryTimeline'
import { DemoBanner } from '../components/ExecutiveDashboardPanels'
import { incidentReportPdfUrl } from '../api/executive-demo-api'
import { IntelligenceFlowSections } from '@/modules/intelligence-flow/components/IntelligenceFlowSections'

export function IncidentReportPage() {
  const { incidentId } = useParams()
  const [includeDemo, setIncludeDemo] = useState(false)
  const query = useIncidentReport(incidentId, includeDemo)
  const report = query.data
  const institutional = report?.institutional

  if (query.isLoading) {
    return (
      <div className="p-6">
        <p className="mb-4 text-sm text-text-secondary">
          Generando informe: preparando datos · construyendo secciones · documentando timeline…
        </p>
        <OperationalDetailSkeleton />
      </div>
    )
  }
  if (!report) {
    return <p className="p-6 text-sm text-confidence-low">Informe no disponible.</p>
  }

  const classificationLabel = institutional
    ? institutional.classificationLabel
    : classificationBanner(fromLegacyReportClassification(report.classification, includeDemo))

  return (
    <div className="executive-report overflow-y-auto p-4 md:p-8" data-testid="incident-report-page">
      <PageHeader
        title={report.title}
        subtitle={classificationLabel}
        breadcrumbs={[
          { label: 'Situación Nacional', to: '/situacion' },
          { label: 'Informes', to: '/informes' },
          { label: report.title.slice(0, 48) },
        ]}
      />

      {(report.story.is_internal_demo || includeDemo) && (
        <div className="mb-4 print:hidden">
          <DemoBanner />
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={includeDemo} onChange={(e) => setIncludeDemo(e.target.checked)} />
          Incluir demostración
        </label>
        <a
          href={incidentReportPdfUrl(incidentId!, includeDemo)}
          className="rounded bg-accent/20 px-3 py-1 text-xs text-accent"
        >
          Descargar PDF
        </a>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded border border-border-subtle px-3 py-1 text-xs"
        >
          Imprimir
        </button>
        <Link to={`/incidentes/${incidentId}/historia`} className="text-xs text-accent hover:underline">
          Ver historia
        </Link>
      </div>

      <div className="print:hidden">
        <IntelligenceFlowSections resourceType="incident" resourceId={incidentId} />
      </div>

      {institutional ? (
        <InstitutionalReportView report={institutional} />
      ) : (
        <>
          <p className="mb-6 text-sm text-text-secondary">{report.story.coverage.label}</p>
          {report.sections.map((s) => (
            <section key={s.id} className="mb-6">
              <h2 className="text-base font-medium">{s.title}</h2>
              <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">{s.content}</p>
            </section>
          ))}
        </>
      )}

      <div className="mt-8 print:hidden">
        <h2 className="mb-4 text-base font-medium">Timeline visual</h2>
        <IncidentStoryTimeline stages={report.story.stages} />
      </div>
    </div>
  )
}
