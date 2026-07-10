import { Globe } from 'lucide-react'
import type { FireDashboardHeader } from '@/modules/fires/utils/fire-dashboard'
import { useSecondsSince } from '@/shared/hooks/useLiveClock'
import { cn } from '@/shared/utils/cn'

interface DailyBriefHeaderBarProps {
  data: FireDashboardHeader
}

export function DailyBriefHeaderBar({ data }: DailyBriefHeaderBarProps) {
  const uiSeconds = useSecondsSince(data.uiRefreshAt)

  const ticker = [
    { label: 'Sistema operativo', value: null, dot: true, status: data.systemStatus },
    { label: 'Fuentes', value: data.sourcesQueriedLabel },
    { label: 'Detecciones', value: data.detectionsNational.toString() },
    { label: 'Eventos', value: data.eventsThermal.toString() },
    {
      label: 'Atención',
      value: data.attentionCount.toString(),
      warn: data.attentionCount > 0,
    },
    {
      label: 'FIRMS',
      value: data.firmsIngestionLabel ?? '—',
      accent: true,
    },
    { label: 'UI', value: `${uiSeconds}s` },
  ]

  return (
    <header className="shrink-0 border-b border-border-subtle bg-surface-1/80 backdrop-blur-md">
      <div className="flex items-center justify-between px-5 py-2">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-subtle">
            <Globe className="h-3.5 w-3.5 text-accent" />
          </div>
          <span className="text-sm font-semibold text-text-primary">TerraMind</span>
          <span className="text-border-strong">·</span>
          <span className="text-lg leading-none">🇬🇹</span>
          <span className="text-sm text-text-secondary">{data.countryName}</span>
        </div>
      </div>

      <div className="flex items-center gap-0 overflow-x-auto border-t border-border-subtle px-5 py-2 scrollbar-none">
        {ticker.map((item, i) => (
          <div key={item.label} className="flex shrink-0 items-center">
            {i > 0 && <span className="mx-3 text-border-subtle">|</span>}
            {item.dot ? (
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span
                    className={cn(
                      'absolute inline-flex h-full w-full animate-ping rounded-full opacity-40',
                      item.status === 'operational' ? 'bg-confidence-high' : 'bg-status-warning',
                    )}
                  />
                  <span
                    className={cn(
                      'relative inline-flex h-1.5 w-1.5 rounded-full',
                      item.status === 'operational' ? 'bg-confidence-high' : 'bg-status-warning',
                    )}
                  />
                </span>
                <span
                  className={cn(
                    'text-xs',
                    item.status === 'operational' ? 'text-confidence-high' : 'text-status-warning',
                  )}
                >
                  {item.label}
                </span>
              </div>
            ) : (
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
                  {item.label}
                </span>
                <span
                  className={cn(
                    'font-mono text-xs font-semibold',
                    item.accent
                      ? 'text-confidence-high'
                      : item.warn
                        ? 'text-status-warning'
                        : 'text-text-primary',
                  )}
                >
                  {item.value}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </header>
  )
}
