import { lazy, Suspense } from 'react'
import { cn } from '@/shared/utils/cn'
import { useNationalSituation } from '../NationalSituationContext'
import { SITUATION_TABS } from '../national-situation.constants'

const PanoramaTab = lazy(() =>
  import('./tabs/PanoramaTab').then((m) => ({ default: m.PanoramaTab })),
)
const ActividadTab = lazy(() =>
  import('./tabs/ActividadTab').then((m) => ({ default: m.ActividadTab })),
)
const VerificacionTab = lazy(() =>
  import('./tabs/VerificacionTab').then((m) => ({ default: m.VerificacionTab })),
)
const OperacionesTab = lazy(() =>
  import('./tabs/OperacionesTab').then((m) => ({ default: m.OperacionesTab })),
)
const TimelineTab = lazy(() =>
  import('./tabs/TimelineTab').then((m) => ({ default: m.TimelineTab })),
)

function TabPanel({ id }: { id: string }) {
  switch (id) {
    case 'panorama':
      return <PanoramaTab />
    case 'actividad':
      return <ActividadTab />
    case 'verificacion':
      return <VerificacionTab />
    case 'operaciones':
      return <OperacionesTab />
    case 'timeline':
      return <TimelineTab />
    default:
      return null
  }
}

export function SituationTabs() {
  const { activeTab, setActiveTab } = useNationalSituation()

  return (
    <section data-testid="situation-tabs">
      <div className="flex flex-wrap gap-1 border-b border-border-subtle">
        {SITUATION_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 text-sm transition-colors',
              activeTab === tab.id
                ? 'border-b-2 border-accent text-text-primary'
                : 'text-text-tertiary hover:text-text-secondary',
            )}
            data-testid={`situation-tab-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <Suspense
          fallback={
            <div className="h-32 animate-pulse rounded-xl bg-surface-3/40" data-testid="tab-loading" />
          }
        >
          <TabPanel id={activeTab} />
        </Suspense>
      </div>
    </section>
  )
}
