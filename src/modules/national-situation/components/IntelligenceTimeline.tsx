/**
 * "Línea de inteligencia" — most recent operational milestones.
 *
 * Uses canonical `recent_changes`, registry-colored icons (map parity) and
 * deterministic titles. Layout matches the approved reference row.
 */
import { Link } from 'react-router-dom'
import { useNationalSituation } from '../NationalSituationContext'
import { filterEntriesByPeriod } from '../national-situation.constants'
import { timelineEntryTitle } from '../utils/timeline-title'
import { consolidateTimelineEntries } from '../utils/consolidate-timeline'
import {
  EventTypeIcon,
  resolveTimelineEntryVisual,
} from '../utils/timeline-entry-visual'

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('es-GT', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return ''
  }
}

const MAX_ITEMS = 5

function TimelineRow({
  title,
  timestamp,
  href,
  visual,
}: {
  title: string
  timestamp: string
  href?: string
  visual: ReturnType<typeof resolveTimelineEntryVisual>
}) {
  const FallbackIcon = visual.fallbackIcon

  const content = (
    <div className="flex items-center gap-2.5 py-1.5">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${visual.iconClassName}`}
        aria-hidden
      >
        {visual.eventType ? (
          <EventTypeIcon icon={visual.iconKey} color={visual.accentColor} size={15} />
        ) : FallbackIcon ? (
          <FallbackIcon size={15} style={{ color: visual.accentColor }} />
        ) : (
          <EventTypeIcon icon={visual.iconKey} color={visual.accentColor} size={15} />
        )}
      </span>

      <p className="min-w-0 flex-1 text-[11px] leading-snug text-text-primary">{title}</p>

      <time className="shrink-0 text-[11px] font-medium tabular-nums text-[#9898a4]">
        {formatTime(timestamp)}
      </time>
    </div>
  )

  if (href) {
    return (
      <Link to={href} className="block rounded-lg transition-colors hover:bg-white/[0.03]">
        {content}
      </Link>
    )
  }

  return <div className="rounded-lg">{content}</div>
}

export function IntelligenceTimeline() {
  const { dashboardQuery, periodHours, setIntelligenceOpen } = useNationalSituation()
  const dashboard = dashboardQuery.data

  const entries = dashboard
    ? consolidateTimelineEntries(
        filterEntriesByPeriod(dashboard.recent_changes, periodHours),
      ).slice(0, MAX_ITEMS)
    : []

  return (
    <section
      className="flex h-full min-h-0 flex-col rounded-xl border border-border-subtle bg-[#0b111b]/90 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
      data-testid="intelligence-timeline"
      aria-label="Línea de inteligencia"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-text-primary">Línea de inteligencia</p>
        <button
          type="button"
          onClick={() => setIntelligenceOpen(true)}
          className="text-[10px] font-medium text-accent hover:underline"
        >
          Ver cronología →
        </button>
      </div>

      {dashboardQuery.isLoading ? (
        <div className="mt-3 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-surface-3/50" />
              <div className="h-3 flex-1 animate-pulse rounded bg-surface-3/40" />
              <div className="h-3 w-10 animate-pulse rounded bg-surface-3/30" />
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="mt-3 flex-1 text-[11px] text-[#9898a4]">
          No se registraron hitos en el periodo seleccionado.
        </p>
      ) : (
        <ul className="mt-2 flex-1 divide-y divide-border-subtle/40 overflow-y-auto">
          {entries.map((e) => {
            const visual = resolveTimelineEntryVisual(e)
            return (
              <li key={e.id}>
                <TimelineRow
                  title={timelineEntryTitle(e)}
                  timestamp={e.timestamp}
                  href={e.href}
                  visual={visual}
                />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
