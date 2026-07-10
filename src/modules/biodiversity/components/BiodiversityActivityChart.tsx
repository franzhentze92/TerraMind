import type { BiodiversityDashboardActivity } from '@/modules/biodiversity/types/biodiversity-dashboard.types'

interface BiodiversityActivityChartProps {
  activity: BiodiversityDashboardActivity
  className?: string
}

export function BiodiversityActivityChart({ activity, className }: BiodiversityActivityChartProps) {
  const max = Math.max(...activity.by_week.map((w) => w.total), 1)
  const hasData = activity.by_week.some((w) => w.total > 0)

  return (
    <div className={className}>
      <div className="mb-3 flex flex-wrap gap-3 text-[10px] text-text-secondary">
        <span>Período: {activity.selected_period_count} reg.</span>
        <span>30d: {activity.recent_30d_count}</span>
        {activity.truncated && (
          <span className="text-confidence-medium">Muestra truncada</span>
        )}
      </div>
      <div className="mb-2 flex gap-3 text-[10px] text-text-tertiary">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-sky-500/80" />
          GBIF
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500/80" />
          iNaturalist
        </span>
      </div>
      {!hasData ? (
        <p className="text-sm text-text-secondary">Sin actividad registrada en las últimas semanas.</p>
      ) : (
        <div className="flex items-end gap-1" style={{ minHeight: 140, maxHeight: 180 }}>
          {activity.by_week.map((week) => (
            <div
              key={week.week_start}
              className="flex flex-1 flex-col items-center gap-1"
              title={`${week.label}: GBIF ${week.gbif}, iNat ${week.inaturalist}`}
            >
              <div className="flex w-full flex-col justify-end gap-px" style={{ height: 120 }}>
                {week.inaturalist > 0 && (
                  <div
                    className="w-full rounded-t bg-emerald-500/70"
                    style={{ height: `${Math.max(2, (week.inaturalist / max) * 100)}px` }}
                  />
                )}
                {week.gbif > 0 && (
                  <div
                    className="w-full bg-sky-500/70"
                    style={{ height: `${Math.max(2, (week.gbif / max) * 100)}px` }}
                  />
                )}
                {week.total === 0 && <div className="h-1 w-full rounded bg-surface-3" />}
              </div>
              <span className="text-[9px] text-text-tertiary">{week.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
