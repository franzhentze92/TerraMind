import type { FireEventListItemDto } from '@/modules/fires/types/fire.dto'
import { Badge } from '@/shared/components/Badge'
import { cn } from '@/shared/utils/cn'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'
import {
  ACTIVE_STATUS_TOOLTIP,
  eventStatusLabel,
  riskBadgeVariant,
  validationStatusLabel,
} from '@/modules/fires/utils/fire-interpretation'
import { riskLevelLabel } from '@/modules/fires/utils/format'
import { buildThermalEventDisplayName } from '@/modules/fires/utils/thermal-event-display'
import { pluralizeCount } from '@/modules/fires/utils/thermal-labels'

interface FireEventsTableProps {
  items: FireEventListItemDto[]
  selectedId?: string
  compact?: boolean
  onSelect: (id: string) => void
}

function EventRow({
  event,
  selected,
  compact,
  onSelect,
}: {
  event: FireEventListItemDto
  selected: boolean
  compact?: boolean
  onSelect: () => void
}) {
  const title = buildThermalEventDisplayName(event)
  return (
    <tr
      tabIndex={0}
      role="button"
      aria-label={title}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        'cursor-pointer border-b border-border-subtle transition-colors hover:bg-surface-3/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent',
        selected && 'bg-accent-subtle/30',
      )}
    >
      <td className="px-3 py-3 font-mono text-sm font-semibold text-text-primary">
        {Math.round(event.priority_score)}
      </td>
      <td className="px-3 py-3">
        <p className="text-sm font-medium text-text-primary">{title}</p>
        <p className="text-xs text-text-tertiary">{event.department_name ?? '—'}</p>
      </td>
      <td className="px-3 py-3">
        <span title={event.status === 'active' ? ACTIVE_STATUS_TOOLTIP : undefined}>
          <Badge variant="default">{eventStatusLabel(event.status)}</Badge>
        </span>
      </td>
      <td className="px-3 py-3">
        <Badge variant="accent">{validationStatusLabel(event.validation_status)}</Badge>
      </td>
      <td className="px-3 py-3 text-center text-sm text-text-secondary">{event.detection_count}</td>
      <td className="px-3 py-3 text-center text-sm text-text-secondary">{event.satellite_count}</td>{!compact && (
        <>
          <td className="px-3 py-3 font-mono text-sm text-text-secondary">
            {event.max_frp_mw != null ? event.max_frp_mw.toFixed(2) : '—'}
          </td>
          <td className="px-3 py-3 text-sm text-text-secondary">
            {event.persistence_hours != null ? `${event.persistence_hours} h` : '—'}
          </td>
        </>
      )}
      <td className="px-3 py-3 text-xs text-text-tertiary">
        {formatGuatemalaDateTime(event.last_detected_at)}
      </td>
      <td className={cn('px-3 py-3', !compact && 'hidden xl:table-cell')}>
        <Badge variant={riskBadgeVariant(event.risk_level)}>
          {riskLevelLabel(event.risk_level)}
        </Badge>
      </td>
    </tr>
  )
}

function EventCard({
  event,
  selected,
  onSelect,
}: {
  event: FireEventListItemDto
  selected: boolean
  onSelect: () => void
}) {
  const title = buildThermalEventDisplayName(event)
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-lg border border-border-subtle bg-surface-2/60 p-4 text-left transition-colors hover:bg-surface-3/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
        selected && 'border-accent bg-accent-subtle/20',
      )}
      aria-label={title}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-text-primary">{title}</p>
          <p className="mt-0.5 text-xs text-text-tertiary">
            Prioridad {Math.round(event.priority_score)}
          </p>
        </div>
        <Badge variant={riskBadgeVariant(event.risk_level)}>
          {riskLevelLabel(event.risk_level)}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="default">{eventStatusLabel(event.status)}</Badge>
        <Badge variant="accent">{validationStatusLabel(event.validation_status)}</Badge>
      </div>
      <p className="mt-2 text-xs text-text-secondary">
        {pluralizeCount(event.detection_count, 'detección', 'detecciones')} ·{' '}
        {pluralizeCount(event.satellite_count, 'fuente', 'fuentes')} ·{' '}
        {formatGuatemalaDateTime(event.last_detected_at)}
      </p>
    </button>
  )
}

export function FireEventsTable({ items, selectedId, compact, onSelect }: FireEventsTableProps) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-border-subtle lg:block">
        <table
          className={cn(
            'w-full text-left',
            compact ? 'table-fixed' : 'min-w-[900px]',
          )}
          aria-label="Eventos térmicos"
        >
          <thead className="border-b border-border-subtle bg-surface-2/80 text-[10px] uppercase tracking-wider text-text-tertiary">
            <tr>
              <th className="px-3 py-2">Prioridad</th>
              <th className="px-3 py-2">Evento</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Validación</th>
              <th className="px-3 py-2 text-center">Detecciones</th>
              <th className="px-3 py-2 text-center">Fuentes</th>
              {!compact && (
                <>
                  <th className="px-3 py-2">FRP máx.</th>
                  <th className="px-3 py-2">Persist.</th>
                </>
              )}
              <th className="px-3 py-2">Última det.</th>
              <th className={cn('px-3 py-2', !compact && 'hidden xl:table-cell')}>Riesgo</th>
            </tr>
          </thead>
          <tbody>
            {items.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                selected={event.id === selectedId}
                compact={compact}
                onSelect={() => onSelect(event.id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 lg:hidden">
        {items.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            selected={event.id === selectedId}
            onSelect={() => onSelect(event.id)}
          />
        ))}
      </div>
    </>
  )
}
