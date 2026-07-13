/**
 * Deterministic auto-selection for the "Evento seleccionado" panel.
 *
 * Order (approved spec §5): highest operational priority → most recent → most
 * persistent → first stable. Priority is approximated by the event's `severity`
 * (0–1) since the generic event list does not carry the full priority
 * assessment; recency uses `lastObservedAt`; persistence uses `persistence`.
 * The final tiebreak is the event id so the result is fully deterministic.
 */
import type { EnvironmentalEvent } from '@/modules/environmental-events/types/environmental-event.types'

function timestamp(iso: string): number {
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : 0
}

export function compareForAutoSelect(a: EnvironmentalEvent, b: EnvironmentalEvent): number {
  const severity = (b.severity ?? -1) - (a.severity ?? -1)
  if (severity !== 0) return severity
  const recency = timestamp(b.lastObservedAt) - timestamp(a.lastObservedAt)
  if (recency !== 0) return recency
  const persistence = (b.persistence ?? 0) - (a.persistence ?? 0)
  if (persistence !== 0) return persistence
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export function pickAutoSelectEvent(
  events: readonly EnvironmentalEvent[],
): EnvironmentalEvent | undefined {
  if (events.length === 0) return undefined
  return [...events].sort(compareForAutoSelect)[0]
}
