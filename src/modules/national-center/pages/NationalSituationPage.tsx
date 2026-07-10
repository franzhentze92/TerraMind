import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  COUNTRY_INDICATORS,
} from '../data/daily-brief.demo'
import { useDailyBrief } from '../hooks/useDailyBrief'
import { mapReportToUI, DEMO_UI } from '../hooks/mapReportToUI'
import { DailyBriefHeaderBar } from '../components/DailyBriefHeaderBar'
import { CountryIndicatorsPanel } from '../components/CountryIndicatorsPanel'
import { ReasoningSequence } from '../components/ReasoningSequence'
import { ExecutiveSummaryCard } from '../components/ExecutiveSummaryCard'
import { HallazgosList } from '../components/HallazgosList'
import { LiveTimelinePanel } from '../components/LiveTimelinePanel'
import { SourcesFooter } from '../components/SourcesFooter'

export function NationalSituationPage() {
  const { data: report, isLoading, isError } = useDailyBrief()

  const ui = useMemo(() => {
    if (report) return mapReportToUI(report)
    return null
  }, [report])

  const header = ui?.header ?? DEMO_UI.header
  const executiveBrief = ui?.executiveBrief ?? DEMO_UI.executiveBrief
  const hallazgos = ui?.hallazgos ?? DEMO_UI.hallazgos
  const timeline = ui?.timeline ?? DEMO_UI.timeline
  const sources = ui?.sources ?? DEMO_UI.sources
  const lastUpdated = ui?.lastUpdated ?? new Date(Date.now() - 37_000)
  const isLive = !!report && !isError

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-0">
      <DailyBriefHeaderBar data={header} lastUpdated={lastUpdated} />

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
                  {isLive ? 'Inteligencia en vivo' : isLoading ? 'Conectando con TerraMind…' : 'Modo demostración'}
                  {' · '}
                  {new Date().toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
            </div>
          </motion.div>

          <div className="grid gap-8 xl:grid-cols-12">
            <aside className="xl:col-span-2">
              <CountryIndicatorsPanel indicators={COUNTRY_INDICATORS} />
            </aside>

            <main className="space-y-8 xl:col-span-7">
              <ReasoningSequence live={isLive} />
              <ExecutiveSummaryCard brief={executiveBrief} />
              <HallazgosList hallazgos={hallazgos} />
            </main>

            <aside className="xl:col-span-3">
              <div className="sticky top-0 rounded-xl border border-border-subtle bg-surface-2/40 p-5">
                <LiveTimelinePanel entries={timeline} />
              </div>
            </aside>
          </div>
        </div>
      </div>

      <SourcesFooter sources={sources} />
    </div>
  )
}
