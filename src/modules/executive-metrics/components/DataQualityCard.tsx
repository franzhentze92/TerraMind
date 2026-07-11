import { useState } from 'react'

import type { DataQualitySummary } from '@/modules/executive-metrics/executive-metric.types'
import {
  buildDataQualityLines,
  freshnessLabel,
} from '@/modules/executive-metrics/data-quality-summary'

const TONE_DOT: Record<string, string> = {
  operational: 'bg-emerald-400',
  legacy: 'bg-amber-400',
  demo: 'bg-violet-400',
  pending: 'bg-sky-400',
  neutral: 'bg-zinc-400',
}

const FRESHNESS_TONE: Record<DataQualitySummary['freshnessStatus'], string> = {
  fresh: 'text-emerald-300',
  delayed: 'text-amber-300',
  stale: 'text-red-300',
}

/** Compact, expandable data-quality summary for Situación Nacional (spec §10). */
export function DataQualityCard({ summary }: { summary: DataQualitySummary }) {
  const [open, setOpen] = useState(false)
  const lines = buildDataQualityLines(summary)

  return (
    <section className="rounded-xl border border-border-subtle bg-surface-2/40 px-5 py-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <span className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Calidad de datos
        </span>
        <span className={`text-xs font-medium ${FRESHNESS_TONE[summary.freshnessStatus]}`}>
          {freshnessLabel(summary.freshnessStatus)}
        </span>
      </button>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {lines.map((line) => (
          <span key={line.label} className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[line.tone]}`} />
            <span className="text-text-secondary">{line.label}:</span>
            <span className="font-medium text-text-primary">{line.value}</span>
          </span>
        ))}
      </div>

      {open && summary.warnings.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-border-subtle pt-2">
          {summary.warnings.map((w, i) => (
            <li key={i} className="text-[11px] text-amber-200">
              {w}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
