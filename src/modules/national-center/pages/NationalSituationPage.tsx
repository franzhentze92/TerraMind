import { useAuth } from '@/core/auth/AuthProvider'
import { isAuthOperational } from '@/core/auth/auth-status'
import { NationalSituationProvider } from '@/modules/national-situation/NationalSituationContext'
import { ExecutiveOverview } from '@/modules/national-situation/components/ExecutiveOverview'
import { RecentNewsIndicator } from '@/modules/news/components/RecentNewsIndicator'
import {
  IntelligenceLineDrawer,
} from '@/modules/national-situation/components/IntelligenceLineDrawer'
import { SourcesStatusDrawer } from '@/modules/national-situation/components/SourcesStatusDrawer'
import { resetSituationPerformance } from '@/modules/national-situation/situation-performance'
import { useEffect } from 'react'

function NationalSituationContent() {
  return (
    <>
      <ExecutiveOverview />
      <IntelligenceLineDrawer />
      <SourcesStatusDrawer />
    </>
  )
}

export function NationalSituationPage() {
  const { status } = useAuth()

  useEffect(() => {
    resetSituationPerformance()
  }, [])

  if (!isAuthOperational(status)) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-0">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-48 animate-pulse rounded bg-surface-3" />
          <p className="text-sm text-text-tertiary">Cargando situación nacional…</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="h-full overflow-y-auto bg-surface-0"
      data-testid="national-situation-page"
    >
      <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-6">
        <NationalSituationProvider>
          <div className="mb-4">
            <RecentNewsIndicator />
          </div>
          <NationalSituationContent />
        </NationalSituationProvider>
      </div>
    </div>
  )
}
