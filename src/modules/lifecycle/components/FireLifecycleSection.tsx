import { Badge } from '@/shared/components/Badge'
import type { LifecycleSummaryDto, LifecycleTransitionDto } from '../api/lifecycle-api'
import { lifecycleStateLabel, lifecycleStateVariant } from '../utils/lifecycle-labels'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'

interface FireLifecycleSectionProps {
  lifecycle?: LifecycleSummaryDto | null
  transitions?: LifecycleTransitionDto[]
  isLoading?: boolean
}

export function FireLifecycleSection({
  lifecycle,
  transitions,
  isLoading,
}: FireLifecycleSectionProps) {
  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-lg bg-surface-3" />
  }

  if (!lifecycle?.lifecycle_state) {
    return (
      <p className="text-sm text-text-tertiary">
        El ciclo de vida del evento aún no ha sido evaluado.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={lifecycleStateVariant(lifecycle.lifecycle_state)}>
          {lifecycleStateLabel(lifecycle.lifecycle_state)}
        </Badge>
        {lifecycle.time_in_state_hours != null && (
          <span className="text-xs text-text-tertiary">
            {lifecycle.time_in_state_hours} h en este estado
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-text-tertiary">Primera detección</dt>
          <dd className="text-text-secondary">
            {lifecycle.first_detected_at
              ? formatGuatemalaDateTime(lifecycle.first_detected_at)
              : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-text-tertiary">Última detección</dt>
          <dd className="text-text-secondary">
            {lifecycle.last_detected_at
              ? formatGuatemalaDateTime(lifecycle.last_detected_at)
              : '—'}
          </dd>
        </div>
        {lifecycle.monitoring_until && (
          <div className="col-span-2">
            <dt className="text-text-tertiary">Ventana de monitoreo hasta</dt>
            <dd className="text-text-secondary">
              {formatGuatemalaDateTime(lifecycle.monitoring_until)}
            </dd>
          </div>
        )}
      </dl>

      {lifecycle.latest_transition && (
        <p className="text-xs text-text-secondary">{lifecycle.latest_transition.transition_reason}</p>
      )}

      {transitions && transitions.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            Transiciones recientes
          </p>
          {transitions.slice(0, 5).map((t) => (
            <div
              key={t.id}
              className="rounded border border-border-subtle px-2 py-1.5 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="font-medium text-text-primary">
                  {lifecycleStateLabel(t.previous_state)} → {lifecycleStateLabel(t.new_state)}
                </span>
                <span className="text-text-tertiary">
                  {formatGuatemalaDateTime(t.evaluated_at)}
                </span>
              </div>
              <p className="mt-1 text-text-secondary">{t.transition_reason}</p>
              {t.transition_rule && (
                <p className="mt-0.5 text-[10px] text-text-tertiary">{t.transition_rule}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
