import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { useExecutiveDashboard } from '@/modules/executive-demo/hooks/useExecutiveDemo'
import { useExecutiveMetrics, useDataQualitySummary } from '@/modules/executive-metrics/hooks/useExecutiveMetrics'
import { useTerritoryStore } from '@/core/config/territory.store'
import type { SituationPeriodKey, SituationTabId } from './national-situation.constants'
import { SITUATION_PERIOD_OPTIONS, buildPrimaryKpis } from './national-situation.constants'
import { buildNationalExecutiveSummary } from './national-executive-summary'
import { markSituationPerformance } from './situation-performance'

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
  const territoryName = useTerritoryStore((s) => s.territory.countryName)

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
  const dashboardQuery = useExecutiveDashboard(includeDemo)

  const pendingDecisionsCount = dashboardQuery.data?.pending_decisions.length ?? 0

  const primaryKpis = useMemo(
    () => buildPrimaryKpis(metricsQuery.data?.metrics ?? [], pendingDecisionsCount),
    [metricsQuery.data?.metrics, pendingDecisionsCount],
  )

  const summary = useMemo(
    () =>
      buildNationalExecutiveSummary(
        metricsQuery.data?.metrics ?? [],
        dashboardQuery.data,
        periodHours,
      ),
    [metricsQuery.data?.metrics, dashboardQuery.data, periodHours],
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
