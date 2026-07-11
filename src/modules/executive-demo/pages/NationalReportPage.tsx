import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ModuleHeader } from '@/shared/components'
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

  return (
    <div className="executive-report print:bg-white print:text-black">
      <div className="p-4 md:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 print:hidden">
          <ModuleHeader
            title="Informe nacional"
            description="TerraMind National Environmental Intelligence Report"
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
              Demo
            </label>
            <a
              href={nationalReportPdfUrl(period, includeDemo)}
              className="rounded bg-accent/20 px-3 py-1 text-xs text-accent"
            >
              Descargar PDF
            </a>
            <Link to="/informes" className="rounded border border-border-subtle px-3 py-1 text-xs">
              ← Centro de informes
            </Link>
          </div>
        </div>

        {query.isLoading && <p className="text-sm text-text-tertiary">Generando informe…</p>}
        {report && (
          <article className="mx-auto max-w-4xl space-y-8">
            <header className="border-b border-border-subtle pb-6">
              <p className="text-[10px] uppercase tracking-widest text-text-tertiary">TerraMind</p>
              <h1 className="mt-2 text-2xl font-semibold text-text-primary">{report.title}</h1>
              <p className="mt-1 text-sm text-text-secondary">
                Clasificación: {report.classification} · Período: {report.period.preset}
              </p>
              <p className="text-xs text-text-tertiary">
                Generado: {new Date(report.generated_at).toLocaleString('es-GT')}
              </p>
              {includeDemo && <div className="mt-4 print:hidden"><DemoBanner /></div>}
            </header>

            {report.sections.map((s) => (
              <section key={s.id} className="break-inside-avoid">
                <h2 className="text-lg font-medium text-text-primary">{s.title}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-text-secondary">{s.content}</p>
              </section>
            ))}
          </article>
        )}
      </div>
    </div>
  )
}
