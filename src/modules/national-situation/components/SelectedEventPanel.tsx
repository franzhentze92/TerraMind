/**
 * "Amenaza seleccionada" — right-hand threat detail panel.
 *
 * Layout mirrors the approved Situación Nacional reference: type badge, territory,
 * status bar, exposure/economic metrics, benefit-cost ratio and action CTAs.
 * Real values when available; "Pendiente" otherwise.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Scale, X } from 'lucide-react'
import type { EnvironmentalEventType } from '@/modules/environmental-events/types/taxonomy'
import { useNationalSituation } from '../NationalSituationContext'
import { useEnvironmentalEvent } from '@/modules/environmental-events/hooks/useEnvironmentalEvents'
import { EventTypeIcon } from '@/modules/environmental-events/ui/EventTypeIcon'
import { eventDetailHref } from '../utils/event-detail-href'
import {
  buildSelectedThreatModel,
  confidenceToneClass,
  THREAT_PENDING,
  threatToneClass,
} from '../utils/selected-threat-model'

function ThreatStatusBar({
  status,
  confidence,
  severity,
}: {
  status: ReturnType<typeof buildSelectedThreatModel>['status']
  confidence: ReturnType<typeof buildSelectedThreatModel>['confidence']
  severity: ReturnType<typeof buildSelectedThreatModel>['severity']
}) {
  const columns = [status, confidence, severity]

  return (
    <div className="mt-3 grid grid-cols-3 divide-x divide-border-subtle/80 rounded-lg border border-border-subtle/60 bg-surface-1/40 py-2.5">
      {columns.map((col) => (
        <div key={col.label} className="px-2.5 text-center first:pl-3 last:pr-3">
          <p className="text-[10px] text-[#9898a4]">{col.label}</p>
          <p
            className={`mt-0.5 text-[13px] font-semibold leading-tight ${
              col.label === 'Confianza'
                ? confidenceToneClass(col.tone)
                : col.label === 'Severidad'
                  ? threatToneClass(col.tone)
                  : 'text-text-primary'
            }`}
          >
            {col.value}
          </p>
        </div>
      ))}
    </div>
  )
}

function ThreatMetricList({
  metrics,
}: {
  metrics: ReturnType<typeof buildSelectedThreatModel>['metrics']
}) {
  return (
    <dl className="mt-3 space-y-2.5 border-t border-border-subtle/70 pt-3">
      {metrics.map((row) => {
        const Icon = row.icon
        return (
          <div key={row.key} className="flex items-center gap-2.5">
            <Icon
              size={14}
              className={row.danger ? 'shrink-0 text-status-critical' : 'shrink-0 text-text-tertiary'}
              aria-hidden
            />
            <dt
              className={`min-w-0 flex-1 text-[11px] leading-snug ${
                row.danger ? 'text-status-critical' : 'text-[#9898a4]'
              }`}
            >
              {row.label}
            </dt>
            <dd
              className={`shrink-0 text-right text-[12px] font-semibold tabular-nums ${
                row.danger ? 'text-status-critical' : 'text-text-primary'
              }`}
            >
              {row.value}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

function BenefitCostBox({ ratio }: { ratio: string }) {
  const pending = ratio === THREAT_PENDING

  return (
    <div
      className={`mt-3 flex items-center justify-between rounded-lg border px-3 py-2.5 ${
        pending
          ? 'border-border-subtle/70 bg-surface-1/30'
          : 'border-confidence-high/50 bg-confidence-high/5'
      }`}
    >
      <span className="text-[11px] text-[#9898a4]">Beneficio-costo estimado</span>
      <span
        className={`text-lg font-bold tabular-nums ${
          pending ? 'text-[#b8b8c2]' : 'text-confidence-high'
        }`}
      >
        {ratio}
      </span>
    </div>
  )
}

function ThreatActions({ eventType, eventId }: { eventType: EnvironmentalEventType; eventId: string }) {
  return (
    <div className="mt-3 space-y-2 border-t border-border-subtle/70 pt-3">
      <Link
        to="/misiones"
        className="group flex w-full items-center justify-between rounded-lg bg-[#f5c518] px-3 py-2.5 text-[13px] font-bold text-[#0a0a0c] transition-colors hover:bg-[#f7d03a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f5c518]/60"
      >
        <span>Crear misión y plan de acción</span>
        <ChevronRight
          size={16}
          className="transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>

      <div className="grid grid-cols-2 gap-2">
        <Link
          to={eventDetailHref(eventType, eventId)}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border-subtle bg-surface-1/50 px-2 py-2 text-[10px] font-medium text-text-primary transition-colors hover:border-border-default hover:bg-surface-2/60"
        >
          Ver detalles del evento
        </Link>
        <Link
          to="/respuesta"
          className="group inline-flex items-center justify-center gap-1 rounded-lg border border-border-subtle bg-surface-1/50 px-2 py-2 text-[10px] font-medium text-text-primary transition-colors hover:border-border-default hover:bg-surface-2/60"
        >
          <Scale size={12} className="text-text-secondary" aria-hidden />
          <span>Comparar opciones</span>
          <ChevronRight
            size={12}
            className="text-text-secondary transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      </div>
    </div>
  )
}

export function SelectedEventPanel() {
  const { selectedEventId, setSelectedEventId } = useNationalSituation()
  const eventQuery = useEnvironmentalEvent(selectedEventId)
  const event = eventQuery.data

  const panelShell = (children: ReactNode) => (
    <section
      className="flex h-full min-h-0 flex-col rounded-xl border border-border-subtle bg-[#0b111b]/90 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
      data-testid="selected-event-panel"
      aria-label="Amenaza seleccionada"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-text-primary">Amenaza seleccionada</p>
        {selectedEventId ? (
          <button
            type="button"
            onClick={() => setSelectedEventId(undefined)}
            className="rounded p-0.5 text-text-tertiary transition-colors hover:text-text-primary"
            aria-label="Cerrar detalle de la amenaza"
          >
            <X size={14} aria-hidden />
          </button>
        ) : null}
      </div>
      {children}
    </section>
  )

  if (!selectedEventId) {
    return panelShell(
      <p className="mt-4 flex-1 text-xs leading-relaxed text-text-secondary">
        Seleccione un evento en el mapa para ver su detalle.
      </p>,
    )
  }

  if (eventQuery.isLoading) {
    return panelShell(
      <div className="mt-3 space-y-2.5">
        <div className="h-6 w-44 animate-pulse rounded-full bg-surface-3/50" />
        <div className="h-7 w-full animate-pulse rounded bg-surface-3/40" />
        <div className="h-14 w-full animate-pulse rounded-lg bg-surface-3/35" />
        <div className="h-32 w-full animate-pulse rounded bg-surface-3/30" />
        <div className="h-10 w-full animate-pulse rounded-lg bg-surface-3/25" />
      </div>,
    )
  }

  if (eventQuery.isError || !event) {
    return panelShell(
      <p className="mt-3 text-xs text-status-critical">
        No se pudo cargar la amenaza seleccionada.
      </p>,
    )
  }

  const threat = buildSelectedThreatModel(event)

  return panelShell(
    <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-y-auto">
      <span
        className="inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
        style={{
          color: threat.accentColor,
          borderColor: `${threat.accentColor}88`,
          backgroundColor: `${threat.accentColor}12`,
        }}
      >
        <EventTypeIcon icon={threat.icon} color={threat.accentColor} size={13} />
        {threat.typeLabel}
      </span>

      <h3 className="mt-2.5 text-[17px] font-bold leading-tight text-text-primary">{threat.title}</h3>
      {threat.territoryLine ? (
        <p className="mt-1 text-[11px] text-text-secondary">{threat.territoryLine}</p>
      ) : (
        <p className="mt-1 text-[11px] text-[#b8b8c2]">{THREAT_PENDING}</p>
      )}

      <ThreatStatusBar
        status={threat.status}
        confidence={threat.confidence}
        severity={threat.severity}
      />

      <ThreatMetricList metrics={threat.metrics} />
      <BenefitCostBox ratio={threat.benefitCostRatio} />
      <ThreatActions eventType={event.eventType} eventId={event.id} />
    </div>,
  )
}
