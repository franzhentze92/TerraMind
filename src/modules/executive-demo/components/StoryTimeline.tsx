import { Link } from 'react-router-dom'
import type { NationalTimelineEntry, StoryStageEntry } from '../types/executive-demo.types'
import { cn } from '@/shared/utils/cn'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'

const EPISTEMIC_STYLES: Record<string, string> = {
  observed: 'border-l-emerald-500',
  inferred: 'border-l-sky-500',
  verified: 'border-l-violet-500',
  undetermined: 'border-l-zinc-500',
  recommended: 'border-l-amber-500',
  decided: 'border-l-orange-500',
  executed: 'border-l-teal-500',
}

export function NationalTimeline({
  entries,
  filter,
  onFilterChange,
}: {
  entries: NationalTimelineEntry[]
  filter: string
  onFilterChange: (v: string) => void
}) {
  const filtered =
    filter === 'all' ? entries : entries.filter((e) => e.stage === filter || e.stage_label === filter)

  return (
    <section className="rounded-xl border border-border-subtle bg-surface-2/40 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Timeline nacional
        </p>
        <select
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="rounded border border-border-subtle bg-surface-1 px-2 py-1 text-xs"
        >
          <option value="all">Todos</option>
          <option value="observation">Observaciones</option>
          <option value="event">Eventos</option>
          <option value="finding">Hallazgos</option>
          <option value="incident">Incidentes</option>
          <option value="mission">Misiones</option>
        </select>
      </div>
      <ul className="mt-3 max-h-96 space-y-2 overflow-y-auto">
        {filtered.map((e) => (
          <li
            key={e.id}
            className={cn(
              'border-l-2 pl-3',
              EPISTEMIC_STYLES[e.epistemic] ?? 'border-l-zinc-500',
            )}
          >
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-text-tertiary">
              <span>{formatGuatemalaDateTime(e.timestamp)}</span>
              <span>{e.stage_label}</span>
              <span>{e.epistemic}</span>
              {e.is_internal_demo && (
                <span className="text-amber-400">demo interna</span>
              )}
            </div>
            {e.href ? (
              <Link to={e.href} className="text-sm text-text-primary hover:text-accent">
                {e.summary}
              </Link>
            ) : (
              <p className="text-sm text-text-primary">{e.summary}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function IncidentStoryTimeline({ stages }: { stages: StoryStageEntry[] }) {
  return (
    <ol className="relative space-y-4 border-l border-border-subtle pl-6">
      {stages.map((stage) => (
        <li key={stage.key} className="relative">
          <span
            className={cn(
              'absolute -left-[1.65rem] top-1 h-3 w-3 rounded-full border-2 bg-surface-0',
              stage.status === 'present'
                ? 'border-emerald-500'
                : stage.status === 'blocked'
                  ? 'border-amber-500'
                  : 'border-zinc-500',
            )}
          />
          <div className="rounded-lg border border-border-subtle bg-surface-1/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-text-primary">
                  {stage.order}. {stage.title}
                </p>
                <p className="text-[10px] text-text-tertiary">
                  {stage.epistemic} · {stage.status}
                  {stage.timestamp && ` · ${formatGuatemalaDateTime(stage.timestamp)}`}
                </p>
              </div>
              {stage.href && (
                <Link to={stage.href} className="text-xs text-accent hover:underline">
                  Ver registro →
                </Link>
              )}
            </div>
            <p className="mt-2 text-sm text-text-secondary">{stage.summary}</p>
            {stage.detail && (
              <p className="mt-1 text-xs text-text-tertiary">{stage.detail}</p>
            )}
            {stage.empty_state && (
              <p className="mt-2 text-xs italic text-text-tertiary">{stage.empty_state.fed_by}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
