import type { NationalMetrics } from '@/modules/national-center/data/situation.demo'
import { formatObservationCount, useSecondsSince } from '@/shared/hooks/useLiveClock'
import { motion } from 'framer-motion'

interface NationalStatusBarProps {
  countryName: string
  countryFlag: string
  metrics: NationalMetrics
  lastUpdated: Date
}

export function NationalStatusBar({ countryName, countryFlag, metrics, lastUpdated }: NationalStatusBarProps) {
  const seconds = useSecondsSince(lastUpdated)

  const stats = [
    { label: 'Fuentes conectadas', value: metrics.sourcesConnected.toString() },
    { label: 'Observaciones hoy', value: formatObservationCount(metrics.observationsToday) },
    { label: 'Anomalías detectadas', value: metrics.anomaliesDetected.toString(), alert: true },
    { label: 'Confianza nacional', value: `${metrics.nationalConfidence}%`, highlight: true },
  ]

  return (
    <div className="border-b border-border-subtle bg-surface-1/50">
      <div className="px-6 py-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{countryFlag}</span>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
                  {countryName}
                </h1>
                <p className="text-sm font-medium text-text-secondary">Situación Nacional</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-text-tertiary">
              Última actualización:{' '}
              <span className="font-mono text-text-secondary">
                hace {seconds} {seconds === 1 ? 'segundo' : 'segundos'}
              </span>
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
              className="rounded-lg border border-border-subtle bg-surface-2 px-4 py-3"
            >
              <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                {stat.label}
              </p>
              <p
                className={`mt-1 font-mono text-lg font-semibold ${
                  stat.alert
                    ? 'text-status-warning'
                    : stat.highlight
                      ? 'text-confidence-high'
                      : 'text-text-primary'
                }`}
              >
                {stat.value}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
