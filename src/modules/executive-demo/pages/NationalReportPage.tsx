import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ModuleHeader, OperationalDetailSkeleton } from '@/shared/components'
import { InstitutionalReportView } from '@/modules/institutional-reports/components/InstitutionalReportView'
import { classificationBanner, fromLegacyReportClassification } from '@/modules/institutional-reports/report-classification'
import { useNationalReport } from '../hooks/useExecutiveDemo'
import { DemoBanner } from '../components/ExecutiveDashboardPanels'
import { nationalReportPdfUrl } from '../api/executive-demo-api'

const PERIODS = [
  { id: '24h', label: '24 horas' },
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
] as const

export function NationalReportPage() {
  const [period, setPeriod] = useState('7d')
  const [includeDemo, setIncludeDemo] = useState(false)
  const query = useNationalReport(period, includeDemo)
  const report = query.data
  const institutional = report?.institutional

  return (
    <div className="executive-report print:bg-white print:text-black">
      <div className="p-4 md:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 print:hidden">
          <ModuleHeader
            title="Informe nacional"
            description="Informe Nacional de Inteligencia Ambiental · entregable institucional"
          />
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`rounded px-3 py-1 text-xs ${period === p.id ? 'bg-accent/20 text-accent' : 'border border-border-subtle'}`}
              >
                {p.label}
              </button>
            ))}
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={includeDemo} onChange={(e) => setIncludeDemo(e.target.checked)} />
              Incluir demostración
            </label>
            <a
              href={nationalReportPdfUrl(period, includeDemo)}
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
            <Link to="/informes" className="rounded border border-border-subtle px-3 py-1 text-xs">
              ← Centro de informes
            </Link>
          </div>
        </div>

        {query.isLoading && (
          <div>
            <p className="mb-4 text-sm text-text-secondary">
              Generando informe: preparando datos · construyendo secciones · renderizando mapa ·
              finalizando documento…
            </p>
            <OperationalDetailSkeleton />
          </div>
        )}
        {query.isError && (
          <p className="text-sm text-confidence-low">
            No se pudo generar el informe. Intente de nuevo o contacte al administrador.
          </p>
        )}
        {institutional && (
          <>
            {includeDemo && (
              <div className="mb-4 print:hidden">
                <DemoBanner />
              </div>
            )}
            <InstitutionalReportView report={institutional} />
          </>
        )}
        {report && !institutional && (
          <p className="text-sm text-confidence-low">
            El modelo institucional no está disponible. Clasificación:{' '}
            {classificationBanner(fromLegacyReportClassification(report.classification, includeDemo))}
          </p>
        )}
      </div>
    </div>
  )
}
