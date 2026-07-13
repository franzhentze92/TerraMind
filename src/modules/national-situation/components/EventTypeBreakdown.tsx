/**
 * "Por tipo de evento (activos)" — compact registry-driven chips.
 *
 * Types, labels, icons and colors all come from the EnvironmentalEventRegistry
 * via the server-authoritative enabled-type list. No hardcoded types, no
 * disabled types, no invented categories.
 */
import { useNationalSituation } from '../NationalSituationContext'
import { EventTypeIcon } from '@/modules/environmental-events/ui/EventTypeIcon'

function pct(count: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((count / total) * 100)
}

export function EventTypeBreakdown() {
  const { eventTypes } = useNationalSituation()
  const { types, isLoading, isError, refetch } = eventTypes
  const total = types.reduce((sum, t) => sum + t.activeCount, 0)

  return (
    <section
      className="flex h-full flex-col rounded-xl border border-border-subtle bg-surface-2/40 px-3 py-2.5"
      data-testid="event-type-breakdown"
      aria-label="Distribución por tipo de evento activo"
    >
      <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
        Por tipo de evento (activos)
      </p>

      {isLoading ? (
        <div className="mt-2 flex flex-1 items-center gap-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-8 w-full animate-pulse rounded-lg bg-surface-3/50" />
          ))}
        </div>
      ) : isError ? (
        <div className="mt-2 flex flex-1 flex-col items-start justify-center gap-2">
          <p className="text-xs text-text-secondary">
            No se pudo cargar el catálogo de tipos de evento.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-md border border-border-subtle px-2 py-1 text-[11px] font-medium text-text-secondary hover:bg-surface-3/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
          >
            Reintentar
          </button>
        </div>
      ) : types.length === 0 ? (
        <p className="mt-2 flex-1 text-xs text-text-secondary">
          No hay tipos de evento habilitados con datos.
        </p>
      ) : types.length === 1 ? (
        // Single type: a proper visual tile (icon disc · big number · label)
        // instead of a cramped "·"-separated line that breaks awkwardly.
        <div
          className="mt-2 flex flex-1 items-center gap-3"
          data-testid="event-type-breakdown-single"
        >
          <span
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full"
            style={{
              backgroundColor: `${types[0].accentColor}22`,
              color: types[0].accentColor,
            }}
            aria-hidden
          >
            <EventTypeIcon icon={types[0].icon} color={types[0].accentColor} size={20} />
          </span>
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold leading-none text-text-primary">
                {types[0].activeCount}
              </span>
              <span className="truncate text-sm font-medium text-text-primary">
                {types[0].label}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-text-secondary">
              {pct(types[0].activeCount, total)} % de los eventos activos
            </p>
          </div>
        </div>
      ) : (
        // Multiple types: compact horizontal indicators from the registry.
        <ul className="mt-2 flex flex-1 flex-col justify-center gap-1.5">
          {types.map((t) => (
            <li
              key={t.type}
              className="flex items-center gap-2 text-xs"
              title={`${t.label}: ${t.activeCount} ${t.activeCount === 1 ? 'evento activo' : 'eventos activos'}`}
            >
              <EventTypeIcon icon={t.icon} color={t.accentColor} size={14} />
              <span className="min-w-0 flex-1 truncate text-text-secondary">{t.label}</span>
              <span className="font-semibold text-text-primary">{t.activeCount}</span>
              <span className="w-9 text-right text-text-tertiary">{pct(t.activeCount, total)} %</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
