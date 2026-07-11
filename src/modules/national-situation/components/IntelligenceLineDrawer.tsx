import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useNationalSituation } from '../NationalSituationContext'
import { filterEntriesByPeriod } from '../national-situation.constants'
import { epistemicLabel } from '../utils/situation-labels'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'
import { cn } from '@/shared/utils/cn'

const EPISTEMIC_STYLES: Record<string, string> = {
  observed: 'border-l-emerald-500',
  inferred: 'border-l-sky-500',
  verified: 'border-l-violet-500',
  recommended: 'border-l-amber-500',
  decided: 'border-l-orange-500',
  executed: 'border-l-teal-500',
}

function DrawerShell({
  open,
  onClose,
  title,
  children,
  testId,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  testId: string
}) {
  if (!open) return null
  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/40"
        aria-label="Cerrar panel"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border-subtle bg-surface-1 shadow-xl"
        data-testid={testId}
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <p className="text-sm font-medium text-text-primary">{title}</p>
          <button type="button" onClick={onClose} className="text-xs text-text-tertiary">
            Cerrar
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </aside>
    </>
  )
}

export function IntelligenceLinePreview() {
  const { dashboardQuery, periodHours, setIntelligenceOpen } = useNationalSituation()
  const entries = filterEntriesByPeriod(dashboardQuery.data?.recent_changes ?? [], periodHours)
  const preview = entries.slice(0, 3)

  return (
    <section
      className="hidden rounded-xl border border-border-subtle bg-surface-2/40 px-4 py-3 md:block lg:hidden xl:block"
      data-testid="intelligence-line-preview"
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Línea de inteligencia
        </p>
        <button
          type="button"
          onClick={() => setIntelligenceOpen(true)}
          className="text-xs text-accent"
          data-testid="intelligence-drawer-trigger"
        >
          Ver línea de inteligencia
        </button>
      </div>
      {preview.length === 0 ? (
        <p className="mt-2 text-sm text-text-secondary">Sin hitos recientes en el período.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {preview.map((e) => (
            <li
              key={e.id}
              className={cn('border-l-2 pl-2', EPISTEMIC_STYLES[e.epistemic] ?? 'border-l-zinc-500')}
            >
              <p className="text-[10px] text-text-tertiary">
                {formatGuatemalaDateTime(e.timestamp)} · {e.stage_label}
              </p>
              {e.href ? (
                <Link to={e.href} className="text-xs text-text-primary hover:text-accent">
                  {e.summary}
                </Link>
              ) : (
                <p className="text-xs text-text-primary">{e.summary}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function IntelligenceLineDrawer() {
  const { intelligenceOpen, setIntelligenceOpen, dashboardQuery, periodHours, setActiveTab } =
    useNationalSituation()
  const [filter, setFilter] = useState('all')
  const entries = filterEntriesByPeriod(dashboardQuery.data?.recent_changes ?? [], periodHours)
  const filtered =
    filter === 'all' ? entries : entries.filter((e) => e.stage === filter || e.stage_label === filter)

  return (
    <DrawerShell
      open={intelligenceOpen}
      onClose={() => setIntelligenceOpen(false)}
      title="Línea de inteligencia"
      testId="intelligence-line-drawer"
    >
      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mb-3 w-full rounded border border-border-subtle bg-surface-2 px-2 py-1 text-xs"
      >
        <option value="all">Todos</option>
        <option value="observation">Observaciones</option>
        <option value="event">Eventos</option>
        <option value="finding">Hallazgos</option>
        <option value="incident">Incidentes</option>
        <option value="mission">Misiones</option>
      </select>
      <ul className="space-y-3">
        {filtered.map((e) => (
          <li
            key={e.id}
            className={cn('border-l-2 pl-3', EPISTEMIC_STYLES[e.epistemic] ?? 'border-l-zinc-500')}
          >
            <p className="text-[10px] text-text-tertiary">
              {formatGuatemalaDateTime(e.timestamp)} · {e.stage_label} · {epistemicLabel(e.epistemic)}
            </p>
            {e.href ? (
              <Link to={e.href} className="text-sm hover:text-accent">
                {e.summary}
              </Link>
            ) : (
              <p className="text-sm">{e.summary}</p>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          setIntelligenceOpen(false)
          setActiveTab('timeline')
        }}
        className="mt-4 text-xs text-accent"
      >
        Abrir la pestaña Cronología completa →
      </button>
    </DrawerShell>
  )
}
