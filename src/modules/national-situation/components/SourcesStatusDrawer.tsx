import { Link } from 'react-router-dom'
import { useNationalSituation } from '../NationalSituationContext'
import { buildDataQualityLines, freshnessLabel } from '@/modules/executive-metrics/data-quality-summary'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'
import { cn } from '@/shared/utils/cn'

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

export function SourcesStatusDrawer() {
  const { sourcesOpen, setSourcesOpen, dqQuery, dashboardQuery } = useNationalSituation()
  const dq = dqQuery.data
  const dashboard = dashboardQuery.data

  const sources = [
    {
      id: 'firms',
      name: 'NASA FIRMS',
      status: dq?.freshnessStatus === 'fresh' ? 'connected' : dq?.freshnessStatus === 'delayed' ? 'degraded' : 'offline',
      lastSync: dashboard?.last_sync_at,
      coverage: 'Guatemala · detecciones térmicas',
      warnings: dq?.warnings ?? [],
    },
    {
      id: 'pipeline',
      name: 'Pipeline TerraMind',
      status: dashboard?.system_status === 'operational' ? 'connected' : 'degraded',
      lastSync: dashboard?.generated_at,
      coverage: 'Eventos · hallazgos · prioridades',
      warnings: [] as string[],
    },
  ]

  return (
    <DrawerShell
      open={sourcesOpen}
      onClose={() => setSourcesOpen(false)}
      title="Fuentes activas"
      testId="sources-status-drawer"
    >
      {dqQuery.isError && (
        <div className="mb-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          Error al cargar calidad de datos.{' '}
          <button type="button" onClick={() => dqQuery.refetch()} className="underline">
            Reintentar
          </button>
        </div>
      )}

      {dq && (
        <p className="mb-4 text-xs text-text-secondary">
          Frescura global:{' '}
          <span className={cn(dq.freshnessStatus === 'fresh' ? 'text-emerald-300' : 'text-amber-300')}>
            {freshnessLabel(dq.freshnessStatus)}
          </span>
        </p>
      )}

      <ul className="space-y-4">
        {sources.map((s) => (
          <li key={s.id} className="rounded-lg border border-border-subtle bg-surface-2/40 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-text-primary">{s.name}</p>
              <StatusDot status={s.status} />
            </div>
            <dl className="mt-2 space-y-1 text-xs text-text-secondary">
              <div>
                <dt className="inline text-text-tertiary">Última actualización: </dt>
                <dd className="inline">
                  {s.lastSync ? formatGuatemalaDateTime(s.lastSync) : 'n/d'}
                </dd>
              </div>
              <div>
                <dt className="inline text-text-tertiary">Cobertura: </dt>
                <dd className="inline">{s.coverage}</dd>
              </div>
            </dl>
            {s.warnings.length > 0 && (
              <ul className="mt-2 space-y-1">
                {s.warnings.map((w, i) => (
                  <li key={i} className="text-[11px] text-amber-200">
                    {w}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {dq && (
        <div className="mt-4 rounded-lg border border-border-subtle bg-surface-2/30 p-3">
          <p className="text-[10px] font-medium uppercase text-text-tertiary">Calidad de datos</p>
          <ul className="mt-2 space-y-1 text-xs">
            {buildDataQualityLines(dq).map((line) => (
              <li key={line.label} className="flex justify-between">
                <span className="text-text-secondary">{line.label}</span>
                <span className="text-text-primary">{line.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link
        to="/fuentes"
        className="mt-4 inline-block text-xs text-accent"
        onClick={() => setSourcesOpen(false)}
      >
        Ver integraciones →
      </Link>
    </DrawerShell>
  )
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'connected'
      ? 'bg-emerald-400'
      : status === 'degraded'
        ? 'bg-amber-400'
        : 'bg-zinc-500'
  return <span className={cn('h-2 w-2 rounded-full', color)} title={status} />
}
