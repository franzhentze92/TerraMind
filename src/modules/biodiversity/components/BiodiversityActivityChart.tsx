import type { BiodiversityDashboardActivity } from '@/modules/biodiversity/types/biodiversity-dashboard.types'

interface BiodiversityActivityChartProps {
  activity: BiodiversityDashboardActivity
  className?: string
}

export function BiodiversityActivityChart({ activity, className }: BiodiversityActivityChartProps) {
  const max = Math.max(...activity.by_month.map((m: { count: number }) => m.count), 1)

  return (
    <div className={className}>
      <div className="mb-4 flex gap-4 text-xs text-text-secondary">
        <span>30d: {activity.recent_30d}</span>
        <span>90d: {activity.recent_90d}</span>
      </div>
      {activity.by_month.length === 0 ? (
        <p className="text-sm text-text-secondary">Sin actividad registrada en el periodo.</p>
      ) : (
        <div className="flex items-end gap-1" style={{ minHeight: 120 }}>
          {activity.by_month.map((m: { month: string; count: number }) => (
            <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-accent/60"
                style={{ height: `${Math.max(4, (m.count / max) * 100)}px` }}
                title={`${m.month}: ${m.count}`}
              />
              <span className="text-[9px] text-text-tertiary [writing-mode:vertical-lr] rotate-180">
                {m.month.slice(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
