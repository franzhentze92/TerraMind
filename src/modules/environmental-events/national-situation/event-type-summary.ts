/**
 * Environmental Event Framework — Situación Nacional event-type catalog.
 *
 * Provides the per-type summary Situación Nacional consumes WITHOUT redesigning
 * `/situacion`. Rules enforced here:
 *  - only registered (active) types are shown;
 *  - types with zero active events are hidden (no zero placeholders);
 *  - reserved-but-not-implemented types (flood) never appear.
 *
 * Today this yields at most:  "Actividad térmica: N eventos".
 */
import { environmentalEventRegistry } from '@/modules/environmental-events/registry/event-type-registry'
import type { EnvironmentalEventTypeSummary } from '@/modules/environmental-events/types/environmental-event.types'
import { pluralizeCount } from '@/modules/fires/utils/thermal-labels'

export interface EventTypeCatalogItem extends EnvironmentalEventTypeSummary {
  displayLine: string
  href?: string
}

const HREF_BY_TYPE: Partial<Record<string, string>> = {
  thermal_activity: '/incendios',
}

/**
 * Filter and decorate summaries for display. Only registered types with active
 * events survive; everything else is dropped so no zero-state clutter appears.
 */
export function buildActiveEventTypeCatalog(
  summaries: EnvironmentalEventTypeSummary[],
): EventTypeCatalogItem[] {
  const enabled = new Set(environmentalEventRegistry.enabledTypes())
  return summaries
    .filter((s) => enabled.has(s.type) && s.activeCount > 0)
    .map((s) => ({
      ...s,
      href: HREF_BY_TYPE[s.type],
      displayLine: `${s.label}: ${pluralizeCount(s.activeCount, 'evento', 'eventos')}`,
    }))
}
