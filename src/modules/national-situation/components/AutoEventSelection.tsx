/**
 * AutoEventSelection — headless controller that keeps the "Evento seleccionado"
 * panel populated when active events exist.
 *
 * It probes the active events of every enabled type (reusing the same React
 * Query keys as the map, so no extra network requests), picks the best candidate
 * deterministically, and asks the context to apply it without overriding a manual
 * selection. Renders nothing.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useEnvironmentalEvents } from '@/modules/environmental-events/hooks/useEnvironmentalEvents'
import type { EnvironmentalEvent } from '@/modules/environmental-events/types/environmental-event.types'
import type { EnvironmentalEventType } from '@/modules/environmental-events/types/taxonomy'
import { useNationalSituation } from '../NationalSituationContext'
import { pickAutoSelectEvent } from '../utils/auto-select-event'

function TypeEventsProbe({
  type,
  since,
  onItems,
}: {
  type: EnvironmentalEventType
  since: string
  onItems: (type: string, items: EnvironmentalEvent[]) => void
}) {
  // Identical query key to the map's TypeLayer → React Query shares one request,
  // so selection candidates ARE the exact events the map draws (no divergence).
  const query = useEnvironmentalEvents({ type, since, limit: 100 })
  useEffect(() => {
    if (query.data) onItems(type, query.data.items)
  }, [query.data, type, onItems])
  return null
}

export function AutoEventSelection() {
  const { eventTypes, eventsWindowSince, resolveAutoSelection } = useNationalSituation()
  const { types } = eventTypes

  const [itemsByType, setItemsByType] = useState<Record<string, EnvironmentalEvent[]>>({})

  const onItems = useCallback((type: string, items: EnvironmentalEvent[]) => {
    setItemsByType((prev) => {
      const prevIds = (prev[type] ?? []).map((e) => e.id).join(',')
      const nextIds = items.map((e) => e.id).join(',')
      if (prevIds === nextIds) return prev
      return { ...prev, [type]: items }
    })
  }, [])

  const enabledTypes = useMemo(() => new Set(types.map((t) => t.type)), [types])

  const allEvents = useMemo(
    () =>
      Object.entries(itemsByType)
        .filter(([type]) => enabledTypes.has(type as EnvironmentalEventType))
        .flatMap(([, items]) => items),
    [itemsByType, enabledTypes],
  )

  const best = useMemo(() => pickAutoSelectEvent(allEvents), [allEvents])
  const validIdsKey = useMemo(
    () => allEvents.map((e) => e.id).sort().join(','),
    [allEvents],
  )

  useEffect(() => {
    if (allEvents.length === 0) return
    resolveAutoSelection(best?.id, new Set(allEvents.map((e) => e.id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validIdsKey, best?.id, resolveAutoSelection])

  return (
    <>
      {types.map((t) => (
        <TypeEventsProbe
          key={t.type}
          type={t.type}
          since={eventsWindowSince}
          onItems={onItems}
        />
      ))}
    </>
  )
}
