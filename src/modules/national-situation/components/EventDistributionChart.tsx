/**
 * "Distribución por tipo de evento (activos)" — SVG donut.
 *
 * Pure SVG (no chart library). Segments and legend use the registry accent
 * colors. Only enabled types with data are shown; a single type renders as a
 * full ring at 100 %; no events renders an honest empty state. A textual
 * equivalent is provided for accessibility (charts must not rely on color).
 */
import { useNationalSituation } from '../NationalSituationContext'

const RADIUS = 42
const STROKE = 14
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function EventDistributionChart() {
  const { eventTypes } = useNationalSituation()
  const { types, totalActive, isLoading } = eventTypes

  const withData = types.filter((t) => t.activeCount > 0)

  return (
    <section
      className="flex h-full flex-col rounded-xl border border-border-subtle bg-surface-2/40 px-4 py-3"
      data-testid="event-distribution-chart"
      aria-label="Distribución por tipo de evento activo"
    >
      <p className="text-[13px] font-semibold text-text-primary">
        Distribución por tipo de evento (activos)
      </p>

      {isLoading ? (
        <div className="mt-4 h-28 animate-pulse rounded-lg bg-surface-3/40" />
      ) : withData.length === 0 ? (
        <p className="mt-4 flex-1 text-xs text-text-secondary">
          No se detectaron eventos activos para los tipos habilitados.
        </p>
      ) : (
        <div className="mt-3 flex flex-1 items-center gap-4">
          <svg
            viewBox="0 0 100 100"
            className="h-28 w-28 flex-shrink-0 -rotate-90"
            role="img"
            aria-label={`Total ${totalActive} eventos activos distribuidos en ${withData.length} tipos`}
          >
            {(() => {
              let offset = 0
              return withData.map((t) => {
                const fraction = t.activeCount / totalActive
                const dash = fraction * CIRCUMFERENCE
                const seg = (
                  <circle
                    key={t.type}
                    cx="50"
                    cy="50"
                    r={RADIUS}
                    fill="none"
                    stroke={t.accentColor}
                    strokeWidth={STROKE}
                    strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                    strokeDashoffset={-offset}
                  />
                )
                offset += dash
                return seg
              })
            })()}
            <text
              x="50"
              y="50"
              transform="rotate(90 50 50)"
              textAnchor="middle"
              dominantBaseline="central"
              fill="var(--color-text-primary)"
              fontSize="20"
              fontWeight="600"
            >
              {totalActive}
            </text>
          </svg>

          <ul className="flex-1 space-y-1.5 text-xs">
            {withData.map((t) => {
              const pct = Math.round((t.activeCount / totalActive) * 100)
              return (
                <li key={t.type} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: t.accentColor }}
                    aria-hidden
                  />
                  <span className="flex-1 truncate text-text-secondary">{t.label}</span>
                  <span className="font-medium text-text-primary">{t.activeCount}</span>
                  <span className="w-9 text-right text-text-tertiary">{pct}%</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
