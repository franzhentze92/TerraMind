import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useExecutiveDashboard } from '../hooks/useExecutiveDemo'
import {
  DemoBanner,
  EmptyStateCard,
  ExecutiveMetricGrid,
  ExecutiveSummaryPanel,
  SystemStatusBar,
} from './ExecutiveDashboardPanels'
import { NationalTimeline } from './StoryTimeline'
import { ExecutiveNationalMap } from './ExecutiveNationalMap'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'

export function ExecutiveNationalCommandCenter() {
  const [searchParams] = useSearchParams()
  const [includeDemo, setIncludeDemo] = useState(searchParams.get('include_demo') === 'true')
  const [timelineFilter, setTimelineFilter] = useState('all')
  const query = useExecutiveDashboard(includeDemo)
  const data = query.data

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        {includeDemo && <DemoBanner />}
        <div className="rounded-xl border border-border-subtle bg-surface-2/40 px-5 py-8">
          <p className="text-sm text-text-tertiary">Cargando centro de mando ejecutivo…</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SystemStatusBar
          status={data.system_status}
          lastSync={data.last_sync_at}
          sourcesActive={data.sources_active}
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              aria-label="Mostrar demostraciones"
              checked={includeDemo}
              onChange={(e) => setIncludeDemo(e.target.checked)}
            />
            Mostrar demostraciones
          </label>
          <Link
            to="/informes/nacional"
            className="rounded border border-border-subtle px-3 py-1 text-xs hover:border-accent/40"
          >
            Generar informe
          </Link>
        </div>
      </div>

      {includeDemo && <DemoBanner />}

      <ExecutiveMetricGrid metrics={data.metrics} />
      <ExecutiveSummaryPanel summary={data.summary} />

      <section className="rounded-xl border border-border-subtle bg-surface-2/40 px-5 py-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            Hallazgos prioritarios
          </p>
          <Link to="/hallazgos" className="text-xs text-accent">
            Ver todos →
          </Link>
        </div>
        {data.priority_findings.length === 0 ? (
          <p className="mt-2 text-sm text-text-secondary">Sin hallazgos activos en la ventana.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.priority_findings.map((f) => (
              <li key={f.id}>
                <Link to={f.href} className="text-sm text-text-primary hover:text-accent">
                  {f.title}
                  <span className="ml-2 text-[10px] text-text-tertiary">{f.severity_label}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border-subtle bg-surface-2/40 px-5 py-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            Incidentes activos
          </p>
          <Link to="/incidentes" className="text-xs text-accent">
            Ver todos →
          </Link>
        </div>
        {data.active_incidents.length === 0 ? (
          <EmptyStateCard state={data.empty_sections.find((e) => e.section === 'tenant_incidents') ?? {
            section: 'incidents',
            title: 'Incidentes',
            meaning: 'Correlaciones de eventos térmicos',
            why_empty: 'No hay incidentes tenant-owned visibles. Active demostraciones para ver el piloto interno.',
            fed_by: 'Motor de correlación',
            last_known: null,
            action: 'Mostrar demostraciones',
          }} />
        ) : (
          <ul className="mt-3 space-y-2">
            {data.active_incidents.map((inc) => (
              <li
                key={inc.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-border-subtle bg-surface-1/30 px-3 py-2"
              >
                <div>
                  <Link to={inc.href} className="text-sm font-medium text-text-primary hover:text-accent">
                    {inc.id.slice(0, 8)}… · {inc.status}
                  </Link>
                  <p className="text-[10px] text-text-tertiary">{inc.story_coverage}</p>
                </div>
                <div className="flex gap-2">
                  <Link to={inc.story_href} className="text-xs text-accent">
                    Ver historia
                  </Link>
                  <Link to={`/informes/incidentes/${inc.id}`} className="text-xs text-text-tertiary">
                    Informe
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ExecutiveNationalMap includeDemo={includeDemo} activeIncidents={data.active_incidents} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border-subtle bg-surface-2/40 px-5 py-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            Misiones en curso
          </p>
          {data.missions_in_progress.length === 0 ? (
            <p className="mt-2 text-sm text-text-secondary">Sin misiones activas en vista.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {data.missions_in_progress.map((m) => (
                <li key={m.id}>
                  <Link to={m.href} className="text-sm hover:text-accent">
                    {m.title}
                    {m.is_internal_demo && (
                      <span className="ml-1 text-[10px] text-amber-400">(demo)</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border-subtle bg-surface-2/40 px-5 py-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            Evidencia reciente
          </p>
          {data.recent_evidence.length === 0 ? (
            <p className="mt-2 text-sm text-text-secondary">Sin envíos recientes en vista.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {data.recent_evidence.map((e) => (
                <li key={e.id}>
                  <Link to={e.href} className="text-sm hover:text-accent">
                    {e.id.slice(0, 8)}… · {e.status}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {data.empty_sections.slice(0, 3).map((s) => (
        <EmptyStateCard key={s.section} state={s} />
      ))}

      <NationalTimeline
        entries={data.recent_changes}
        filter={timelineFilter}
        onFilterChange={setTimelineFilter}
      />

      <p className="text-[10px] text-text-tertiary">
        Actualizado: {formatGuatemalaDateTime(data.generated_at)}
        {data.recommended_demo_incident_id && (
          <>
            {' · '}
            Demo sugerida:{' '}
            <Link to={`/incidentes/${data.recommended_demo_incident_id}/historia`} className="text-accent">
              {data.recommended_demo_incident_id.slice(0, 8)}…
            </Link>
          </>
        )}
      </p>
    </div>
  )
}
