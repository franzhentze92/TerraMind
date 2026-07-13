/**
 * Consolidates consecutive intelligence-timeline milestones that describe the
 * SAME event (same stage + same deterministic title) within a nearby time
 * window, keeping the most recent one. This avoids showing two identical
 * consecutive rows (e.g. "Actividad térmica agrupada en Sacatepéquez") for the
 * same event/update. It never merges distinct milestones and never invents
 * content — it only drops adjacent duplicates.
 *
 * Entries are expected pre-sorted most-recent-first (as the canonical
 * `recent_changes` timeline is), so the retained row is always the latest.
 */
import { timelineEntryTitle } from './timeline-title'

/** Milestones closer than this are considered the same update for merging. */
const MERGE_WINDOW_MS = 12 * 3_600_000

export interface ConsolidatableEntry {
  stage?: string | null
  summary?: string | null
  stage_label?: string | null
  timestamp: string
}

function isSameMilestone(a: ConsolidatableEntry, b: ConsolidatableEntry): boolean {
  if ((a.stage ?? '') !== (b.stage ?? '')) return false
  if (timelineEntryTitle(a) !== timelineEntryTitle(b)) return false
  const ta = Date.parse(a.timestamp)
  const tb = Date.parse(b.timestamp)
  // Same stage + title but unparseable time → treat as the same milestone.
  if (Number.isNaN(ta) || Number.isNaN(tb)) return true
  return Math.abs(ta - tb) <= MERGE_WINDOW_MS
}

export function consolidateTimelineEntries<T extends ConsolidatableEntry>(entries: T[]): T[] {
  const out: T[] = []
  for (const entry of entries) {
    const prev = out[out.length - 1]
    if (prev && isSameMilestone(prev, entry)) continue
    out.push(entry)
  }
  return out
}
