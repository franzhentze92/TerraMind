import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { COUNTRY_INDICATORS } from '../data/daily-brief.demo'
import { useDailyBrief } from '../hooks/useDailyBrief'
import { DEMO_UI } from '../hooks/mapReportToUI'
import { DailyBriefHeaderBar } from '../components/DailyBriefHeaderBar'
import { CountryIndicatorsPanel } from '../components/CountryIndicatorsPanel'
import { ReasoningSequence } from '../components/ReasoningSequence'
import { ExecutiveSummaryCard } from '../components/ExecutiveSummaryCard'
import { HallazgosList } from '../components/HallazgosList'
import { LiveTimelinePanel } from '../components/LiveTimelinePanel'
import { SourcesFooter } from '../components/SourcesFooter'
import { FireHeatSummaryCard } from '@/modules/fires/components/FireHeatSummaryCard'
import { useFireSummary } from '@/modules/fires/hooks/useFireSummary'
import {
  buildFireDashboardHeader,
  buildFireExecutiveBrief,
  buildFireReasoningSteps,
  buildFireThermalIndicator,
  buildFireTimeline,
} from '@/modules/fires/utils/fire-dashboard'

function HeaderSkeleton() {
  return (
    <header className="shrink-0 border-b border-border-subtle bg-surface-1/80 px-5 py-4">
      <div className="h-4 w-48 animate-pulse rounded bg-surface-3" />
      <div className="mt-3 h-3 w-full max-w-2xl animate-pulse rounded bg-surface-3" />
    </header>
  )
}

export function NationalSituationPage() {
  const { isLoading: briefLoading } = useDailyBrief()
  const fireSummary = useFireSummary()

  const fireData = fireSummary.data
  const hasFireData = Boolean(fireData)

  const header = useMemo(
    () => (fireData ? buildFireDashboardHeader(fireData) : null),
    [fireData],
  )

  const executiveBrief = useMemo(
    () => (fireData ? buildFireExecutiveBrief(fireData) : DEMO_UI.executiveBrief),
    [fireData],
  )

  const timeline = useMemo(
    () => (fireData ? buildFireTimeline(fireData) : DEMO_UI.timeline),
    [fireData],
  )

  const indicators = useMemo(() => {
    if (!fireData) return COUNTRY_INDICATORS
    const fireIndicator = buildFireThermalIndicator(fireData)
    return COUNTRY_INDICATORS.map((ind) =>
      ind.id === 'fire' ? fireIndicator : ind,
    )
  }, [fireData])

  const reasoningSteps = useMemo(
    () => (fireData ? buildFireReasoningSteps(fireData) : undefined),
    [fireData],
  )

  const isLive = hasFireData && !fireSummary.isError
  const showDemoHallazgos = !hasFireData

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-0">
      {header ? (
        <DailyBriefHeaderBar data={header} />
      ) : fireSummary.isLoading ? (
        <HeaderSkeleton />
      ) : (
        <HeaderSkeleton />
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-6"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🇬🇹</span>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-text-primary">
                  Situación Nacional
                </h1>
                <p className="mt-0.5 text-sm text-text-secondary">
                  {isLive
                    ? 'Inteligencia en vivo · focos de calor FIRMS'
                    : fireSummary.isLoading || briefLoading
                      ? 'Conectando con TerraMind…'
                      : 'Modo demostración'}
                  {' · '}
                  {new Date().toLocaleDateString('es-GT', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </p>
              </div>
            </div>
          </motion.div>

          <div className="grid gap-8 xl:grid-cols-12">
            <aside className="xl:col-span-2">
              <CountryIndicatorsPanel indicators={indicators} />
            </aside>

            <main className="space-y-8 xl:col-span-7">
              <ReasoningSequence live={isLive} steps={reasoningSteps} />
              <FireHeatSummaryCard
                data={fireSummary.data}
                isLoading={fireSummary.isLoading}
                isError={fireSummary.isError}
              />
              <ExecutiveSummaryCard brief={executiveBrief} />
              {showDemoHallazgos ? (
                <HallazgosList hallazgos={DEMO_UI.hallazgos} />
              ) : (
                <div className="rounded-xl border border-border-subtle bg-surface-2/40 px-5 py-4">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                    Hallazgos automáticos
                  </p>
                  <p className="mt-2 text-sm text-text-secondary">
                    Los hallazgos derivados de eventos térmicos estarán disponibles en una
                    versión posterior. La priorización actual se muestra en la tarjeta de focos
                    de calor.
                  </p>
                </div>
              )}
            </main>

            <aside className="xl:col-span-3">
              <div className="sticky top-0 rounded-xl border border-border-subtle bg-surface-2/40 p-5">
                <LiveTimelinePanel entries={timeline} live={isLive} />
              </div>
            </aside>
          </div>
        </div>
      </div>

      <SourcesFooter sources={DEMO_UI.sources} />
    </div>
  )
}
