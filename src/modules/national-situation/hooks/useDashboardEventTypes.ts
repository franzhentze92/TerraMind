/**
 * Situación Nacional — enabled event types for the dashboard.
 *
 * Source of truth for *which* types are visible is the SERVER response
 * (`/environmental-events/types`), because runtime feature flags (e.g.
 * `EVENT_FLAG_RAINFALL_DEFICIT`) live on the server and are not readable from
 * the browser. Visual metadata (label, icon, accent color) comes from the
 * client registry manifest, which is registered even for disabled types.
 *
 * This gives us a fully registry-driven dashboard with no per-type branches and
 * no hardcoded type lists: thermal always shows; rainfall deficit appears only
 * when the server flag is on; future types appear automatically.
 */
import { useMemo } from 'react'
import { useEnvironmentalEventTypes } from '@/modules/environmental-events/hooks/useEnvironmentalEvents'
import { environmentalEventRegistry } from '@/modules/environmental-events/registry/event-type-registry'
import { ensureEventsRegistered } from '@/modules/environmental-events/registry/register-all'
import type { EnvironmentalEventType } from '@/modules/environmental-events/types/taxonomy'

export interface DashboardEventType {
  type: EnvironmentalEventType
  label: string
  pluralLabel: string
  icon: string
  accentColor: string
  activeCount: number
  newCount: number
}

export interface DashboardEventTypesResult {
  /** Always an array — never `undefined` — so consumers can map safely. */
  types: DashboardEventType[]
  totalActive: number
  isLoading: boolean
  isError: boolean
  error: Error | null
  /** Retry the underlying catalog request (used by degraded-state UIs). */
  refetch: () => void
}

export function useDashboardEventTypes(windowHours?: number): DashboardEventTypesResult {
  ensureEventsRegistered()
  const typesQuery = useEnvironmentalEventTypes(windowHours)
  const refetch = typesQuery.refetch

  return useMemo(() => {
    const items = typesQuery.data?.items ?? []
    const types: DashboardEventType[] = items
      .filter((item) => environmentalEventRegistry.has(item.type))
      .map((item) => {
        const manifest = environmentalEventRegistry.get(item.type)
        return {
          type: item.type,
          label: manifest.label,
          pluralLabel: manifest.pluralLabel,
          icon: manifest.icon,
          accentColor: environmentalEventRegistry.getAccentColor(item.type),
          activeCount: item.activeCount,
          newCount: item.newCount ?? 0,
        }
      })
    const totalActive = types.reduce((sum, t) => sum + t.activeCount, 0)
    return {
      types,
      totalActive,
      isLoading: typesQuery.isLoading,
      isError: typesQuery.isError,
      error: (typesQuery.error as Error | null) ?? null,
      refetch: () => {
        void refetch()
      },
    }
  }, [typesQuery.data, typesQuery.isLoading, typesQuery.isError, typesQuery.error, refetch])
}
