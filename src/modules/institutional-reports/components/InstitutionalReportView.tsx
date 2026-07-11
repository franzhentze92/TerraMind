import type { InstitutionalReport } from '../institutional-report.types'
import { ReportCover, ReportFooter, ReportHeader } from './ReportChrome'
import { ReportCallout, ReportSection } from './ReportSection'
import {
  ReportFindingsTable,
  ReportIncidentsTable,
  ReportMapBlock,
  ReportMetricsTable,
  ReportSourcesTable,
  ReportTimelineTable,
} from './ReportTable'

import '../report-print.css'

export function InstitutionalReportView({ report }: { report: InstitutionalReport }) {
  return (
    <article className="institutional-report-document" lang="es" data-testid="institutional-report">
      <ReportHeader report={report} />
      <ReportCover report={report} />

      {report.watermark && (
        <ReportCallout title="Clasificación del documento" variant="demo">
          {report.classificationLabel}. No utilizar como informe oficial.
        </ReportCallout>
      )}

      <ReportSection section={report.executiveSummary} />

      {report.type === 'national' && (
        <>
          <ReportMetricsTable metrics={report.metrics} />
          <ReportMapBlock report={report} />
          <ReportFindingsTable findings={report.findings} />
          <ReportIncidentsTable
            incidents={report.incidents}
            emptyMessage="No se registraron incidentes operacionales pertenecientes a la organización durante el periodo."
          />
          {report.legacyIncidents.length > 0 && (
            <>
              <h2 className="institutional-report-section-title">Incidentes legacy</h2>
              <ReportIncidentsTable
                incidents={report.legacyIncidents}
                emptyMessage=""
              />
            </>
          )}
          {report.demoIncidents.length > 0 && (
            <>
              <h2 className="institutional-report-section-title">Demostración interna</h2>
              <ReportIncidentsTable incidents={report.demoIncidents} emptyMessage="" />
            </>
          )}
        </>
      )}

      {report.type === 'incident' &&
        report.sections
          .filter((s) => !['identification', 'executive-summary'].includes(s.id))
          .map((s) => <ReportSection key={s.id} section={s} />)}

      <ReportTimelineTable report={report} />

      <ReportSection
        section={{
          id: 'methodology',
          title: 'Metodología',
          content: [
            report.methodology.general,
            `Periodo: ${report.methodology.period}`,
            `Geografía: ${report.methodology.geography}`,
            `Filtrado: ${report.methodology.filtering}`,
            `Agrupación: ${report.methodology.eventGrouping}`,
            `Prioridad: ${report.methodology.priorityModel}`,
            `Versión: ${report.methodology.version}`,
          ].join('\n'),
        }}
      />

      <ReportSection
        section={{
          id: 'limitations',
          title: 'Limitaciones',
          content: report.limitations.map((l, i) => `${i + 1}. ${l}`).join('\n'),
        }}
      />

      <ReportSourcesTable report={report} />
      <ReportFooter report={report} />
    </article>
  )
}
