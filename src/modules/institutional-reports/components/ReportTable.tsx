import type { InstitutionalReport, ReportFinding, ReportIncident, ReportMetric } from '../institutional-report.types'

export function ReportTable({
  caption,
  headers,
  rows,
}: {
  caption: string
  headers: string[]
  rows: string[][]
}) {
  if (rows.length === 0) return null
  return (
    <div className="institutional-report-table-wrap break-inside-avoid">
      <table className="institutional-report-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ReportMetricsTable({ metrics }: { metrics: ReportMetric[] }) {
  return (
    <ReportTable
      caption="Indicadores nacionales"
      headers={['Indicador', 'Valor', 'Ventana', 'Fuente']}
      rows={metrics.map((m) => [m.label, String(m.value), m.timeWindow, m.source])}
    />
  )
}

export function ReportFindingsTable({ findings }: { findings: ReportFinding[] }) {
  if (findings.length === 0) {
    return <p className="text-sm text-text-secondary">Sin hallazgos prioritarios en el periodo.</p>
  }
  return (
    <ReportTable
      caption="Hallazgos prioritarios"
      headers={['Título', 'Ubicación', 'Severidad', 'Estado']}
      rows={findings.map((f) => [f.title, f.location, f.severity, f.status])}
    />
  )
}

export function ReportIncidentsTable({
  incidents,
  emptyMessage,
}: {
  incidents: ReportIncident[]
  emptyMessage: string
}) {
  if (incidents.length === 0) {
    return <p className="text-sm text-text-secondary">{emptyMessage}</p>
  }
  return (
    <ReportTable
      caption="Incidentes"
      headers={['Nombre', 'Ubicación', 'Estado', 'Eventos', 'Verificación']}
      rows={incidents.map((i) => [
        i.name,
        i.location,
        i.lifecycle,
        String(i.eventCount),
        i.verificationStatus,
      ])}
    />
  )
}

export function ReportSourcesTable({ report }: { report: InstitutionalReport }) {
  return (
    <ReportTable
      caption="Fuentes"
      headers={['Fuente', 'Tipo', 'Cobertura', 'Periodo', 'Estado', 'Limitación']}
      rows={report.sources.map((s) => [
        s.name,
        s.type,
        s.coverage,
        s.period,
        s.status,
        s.limitation,
      ])}
    />
  )
}

export function ReportTimelineTable({ report }: { report: InstitutionalReport }) {
  if (report.timeline.length === 0) return null
  return (
    <ReportTable
      caption="Línea de tiempo institucional"
      headers={['Fecha', 'Etapa', 'Evento', 'Estado', 'Fuente', 'Referencia']}
      rows={report.timeline.map((t) => [
        new Date(t.date).toLocaleString('es-GT'),
        t.stage,
        t.event,
        t.epistemic,
        t.source,
        t.reference,
      ])}
    />
  )
}

export function ReportMapBlock({ report }: { report: InstitutionalReport }) {
  const map = report.maps[0]
  if (!map) return null
  if (!map.available) {
    return (
      <div className="institutional-report-map-fallback break-inside-avoid">
        <h3 className="text-sm font-medium">{map.title}</h3>
        <p className="text-xs text-text-secondary">{map.errorMessage}</p>
        {map.fallbackRows && map.fallbackRows.length > 0 && (
          <ReportTable
            caption="Datos geográficos (tabla)"
            headers={['Elemento', 'Detalle']}
            rows={map.fallbackRows.map((r) => [r.label, r.detail])}
          />
        )}
      </div>
    )
  }
  return null
}
