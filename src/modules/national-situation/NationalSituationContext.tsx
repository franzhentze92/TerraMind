import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { useExecutiveDashboard } from '@/modules/executive-demo/hooks/useExecutiveDemo'
import { useExecutiveMetrics, useDataQualitySummary } from '@/modules/executive-metrics/hooks/useExecutiveMetrics'
import { useTerritoryStore } from '@/core/config/territory.store'
import type { SituationPeriodKey, SituationTabId } from './national-situation.constants'
import {
  SITUATION_PERIOD_OPTIONS,
  buildPrimaryKpis,
  countActiveMissions,
} from './national-situation.constants'
import { buildNationalExecutiveSummary } from './national-executive-summary'
import { normalizeNationalSituationDashboardDto } from './national-situation-dashboard.normalize'
import { markSituationPerformance } from './situation-performance'
import { useDashboardEventTypes, type DashboardEventTypesResult } from './hooks/useDashboardEventTypes'

interface NationalSituationContextValue {
  period: SituationPeriodKey
  setPeriod: (p: SituationPeriodKey) => void
  periodHours: number
  includeDemo: boolean
  setIncludeDemo: (v: boolean) => void
  activeTab: SituationTabId
  setActiveTab: (t: SituationTabId) => void
  intelligenceOpen: boolean
  setIntelligenceOpen: (v: boolean) => void
  sourcesOpen: boolean
  setSourcesOpen: (v: boolean) => void
  territoryName: string
  metricsQuery: ReturnType<typeof useExecutiveMetrics>
  dqQuery: ReturnType<typeof useDataQualitySummary>
  dashboardQuery: ReturnType<typeof useExecutiveDashboard>
  primaryKpis: ReturnType<typeof buildPrimaryKpis>
  summary: ReturnType<typeof buildNationalExecutiveSummary>
  pendingDecisionsCount: number
  eventTypes: DashboardEventTypesResult
  /**
   * Shared, render-stable lower bound (`since`) for the active-event window used
   * by the map, auto-selection and distribution — so they consume EXACTLY the
   * same canonical set the "Eventos activos" KPI counts.
   */
  eventsWindowSince: string
  selectedEventId: string | undefined
  /** Manual selection (map/panel). Marks the choice so auto-selection defers. */
  setSelectedEventId: (id: string | undefined) => void
  /**
   * Auto-selection entry point: keeps the current selection when it is still a
   * valid active event; otherwise applies `bestId`. Never overrides a manual
   * selection while that event is still present.
   */
  resolveAutoSelection: (bestId: string | undefined, validIds: Set<string>) => void
}

const NationalSituationContext = createContext<NationalSituationContextValue | null>(null)

const INTELLIGENCE_PREF_KEY = 'terramind.situacion.intelligenceOpen'

export function NationalSituationProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<SituationPeriodKey>('48h')
  const [includeDemo, setIncludeDemo] = useState(false)
  const [activeTab, setActiveTab] = useState<SituationTabId>('panorama')
  const [intelligenceOpen, setIntelligenceOpenState] = useState(() => {
    try {
      return localStorage.getItem(INTELLIGENCE_PREF_KEY) === 'true'
    } catch {
      return false
    }
  })
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [selectedEventId, setSelectedEventIdState] = useState<string | undefined>(undefined)
  const manualSelectionRef = useRef(false)
  const territoryName = useTerritoryStore((s) => s.territory.countryName)

  const setSelectedEventId = useCallback((id: string | undefined) => {
    manualSelectionRef.current = id !== undefined
    setSelectedEventIdState(id)
  }, [])

  const resolveAutoSelection = useCallback(
    (bestId: string | undefined, validIds: Set<string>) => {
      setSelectedEventIdState((current) => {
        // Preserve any current selection (manual or auto) while it stays valid.
        if (current && validIds.has(current)) return current
        manualSelectionRef.current = false
        return bestId
      })
    },
    [],
  )

  const setIntelligenceOpen = (open: boolean) => {
    setIntelligenceOpenState(open)
    try {
      localStorage.setItem(INTELLIGENCE_PREF_KEY, String(open))
    } catch {
      /* ignore */
    }
  }

  const periodHours = SITUATION_PERIOD_OPTIONS.find((p) => p.key === period)?.hours ?? 48

  const metricsQuery = useExecutiveMetrics({ includeDemo })
  const dqQuery = useDataQualitySummary()
  const dashboardQuery = useExecutiveDashboard(includeDemo, periodHours)
  const eventTypes = useDashboardEventTypes(periodHours)

  // Recomputed only when the period changes (not every render) so the derived
  // query keys stay stable and don't trigger refetch loops.
  const eventsWindowSince = useMemo(
    () => new Date(Date.now() - periodHours * 3_600_000).toISOString(),
    [periodHours],
  )

  const dashboard = useMemo(
    () => normalizeNationalSituationDashboardDto(dashboardQuery.data),
    [dashboardQuery.data],
  )

  const pendingDecisionsCount = dashboard?.pending_decisions.length ?? 0

  // Canonical counts for the visible KPI row. The server-side operational
  // comparison spans ALL rows over the period (the DTO's arrays are capped at 5),
  // so it is the canonical source for missions/decisions; the DTO arrays are only
  // a fallback. Respuestas en marcha stays 0 until a canonical active-response
  // source exists (never inferred from missions or recommendations).
  const opsComparison = dashboard?.operational_period_comparison
  const activeMissions =
    opsComparison?.metrics.missions.current ??
    countActiveMissions(dashboard?.missions_in_progress ?? [], includeDemo)
  const activeResponses = 0
  const pendingDecisionsForKpi = opsComparison?.metrics.decisions.current ?? pendingDecisionsCount

  const primaryKpis = useMemo(
    () =>
      buildPrimaryKpis({
        metrics: metricsQuery.data?.metrics ?? [],
        eventsActive: eventTypes.totalActive,
        activeMissions,
        activeResponses,
        pendingDecisions: pendingDecisionsForKpi,
      }),
    [
      metricsQuery.data?.metrics,
      eventTypes.totalActive,
      activeMissions,
      activeResponses,
      pendingDecisionsForKpi,
    ],
  )

  const summary = useMemo(
    () => buildNationalExecutiveSummary(metricsQuery.data?.metrics ?? [], dashboard, periodHours),
    [metricsQuery.data?.metrics, dashboard, periodHours],
  )

  useEffect(() => {
    if (metricsQuery.data && !metricsQuery.isLoading) {
      markSituationPerformance('kpis_ready')
    }
  }, [metricsQuery.data, metricsQuery.isLoading])

  const value = useMemo(
    () => ({
      period,
      setPeriod,
      periodHours,
      includeDemo,
      setIncludeDemo,
      activeTab,
      setActiveTab,
      intelligenceOpen,
      setIntelligenceOpen,
      sourcesOpen,
      setSourcesOpen,
      territoryName,
      metricsQuery,
      dqQuery,
      dashboardQuery,
      primaryKpis,
      summary,
      pendingDecisionsCount,
      eventTypes,
      eventsWindowSince,
      selectedEventId,
      setSelectedEventId,
      resolveAutoSelection,
    }),
    [
      period,
      periodHours,
      includeDemo,
      activeTab,
      intelligenceOpen,
      sourcesOpen,
      territoryName,
      metricsQuery,
      dqQuery,
      dashboardQuery,
      primaryKpis,
      summary,
      pendingDecisionsCount,
      eventTypes,
      eventsWindowSince,
      selectedEventId,
      setSelectedEventId,
      resolveAutoSelection,
    ],
  )

  return (
    <NationalSituationContext.Provider value={value}>{children}</NationalSituationContext.Provider>
  )
}

export function useNationalSituation() {
  const ctx = useContext(NationalSituationContext)
  if (!ctx) throw new Error('useNationalSituation must be used within NationalSituationProvider')
  return ctx
}
