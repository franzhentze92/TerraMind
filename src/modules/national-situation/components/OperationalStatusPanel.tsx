/**
 * "Estado operativo" — active operational cycle counts.
 *
 * Layout mirrors the approved reference: tinted card · title · status · value · trend.
 * Counts are canonical; trends only when a defensible source exists, else "Pendiente".
 */
import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { Info, X } from 'lucide-react'
import { useNationalSituation } from '../NationalSituationContext'
import {
  buildOperationalStatusCardModels,
  operationalTrendClassName,
} from '../utils/operational-status-panel-model'

function OperationalCard({
  card,
}: {
  card: ReturnType<typeof buildOperationalStatusCardModels>[number]
}) {
  const Icon = card.icon

  return (
    <li>
      <Link
        to={card.href}
        className={`group flex h-full flex-col items-center gap-1 rounded-xl border px-1.5 py-2.5 text-center transition-colors hover:brightness-125 ${card.cardClassName}`}
      >
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-md ${card.iconClassName}`}
          aria-hidden
        >
          <Icon size={15} strokeWidth={1.75} />
        </span>

        <p className="mt-0.5 text-[11px] font-semibold leading-tight text-text-primary">
          {card.label}
        </p>
        <p className="text-[10px] leading-tight text-[#9898a4]">{card.stateLabel}</p>

        <p className="mt-0.5 text-[22px] font-bold leading-none tracking-tight text-text-primary tabular-nums">
          {card.formattedValue}
        </p>

        <p
          className={`text-[11px] font-semibold tabular-nums ${operationalTrendClassName(card.trendDirection)}`}
        >
          {card.trendLabel}
        </p>
      </Link>
    </li>
  )
}

function OperationalInfoDialog({ onClose }: { onClose: () => void }) {
  const items = [
    ['Verificaciones activas', 'Solicitudes abiertas para confirmar en campo o con nueva evidencia una señal detectada, antes de escalar la respuesta.'],
    ['Misiones en curso', 'Operaciones de campo asignadas y en ejecución para levantar evidencia estructurada sobre un evento o incidente.'],
    ['Evidencia pendiente', 'Entregas recibidas desde el campo que aún esperan revisión o validación por parte del equipo.'],
    ['Decisiones pendientes', 'Recomendaciones que requieren aprobación o resolución humana antes de activar una respuesta.'],
    ['Respuestas en marcha', 'Acciones o planes de respuesta ya activados y en ejecución sobre el territorio.'],
  ] as const

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Qué significa Estado operativo"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border-default bg-[#0f141f] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Estado operativo</h3>
            <p className="mt-1 text-[11px] leading-snug text-[#9898a4]">
              Resume el ciclo operativo activo: cuántos casos están en cada etapa entre la detección
              y la respuesta. El porcentaje compara el stock actual con el del inicio del periodo
              seleccionado en el encabezado (p. ej. 48 h, 7 días).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded p-0.5 text-text-tertiary transition-colors hover:text-text-primary"
            aria-label="Cerrar"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <dl className="mt-4 space-y-3 border-t border-border-subtle pt-4">
          {items.map(([term, desc]) => (
            <div key={term}>
              <dt className="text-[12px] font-semibold text-text-primary">{term}</dt>
              <dd className="mt-0.5 text-[11px] leading-snug text-[#9898a4]">{desc}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

export function OperationalStatusPanel() {
  const { dashboardQuery, includeDemo, pendingDecisionsCount } = useNationalSituation()
  const dashboard = dashboardQuery.data
  const [infoOpen, setInfoOpen] = useState(false)

  const missions = (dashboard?.missions_in_progress ?? [])
    .filter((m) => includeDemo || !m.is_internal_demo)
    .filter((m) =>
      ['approved', 'assigned', 'in_progress', 'blocked'].includes(String(m.status)),
    )

  const cards = useMemo(
    () =>
      buildOperationalStatusCardModels({
        comparison: dashboard?.operational_period_comparison,
        fallback: {
          verifications: dashboard?.pending_verifications.length ?? 0,
          missions: missions.length,
          evidence: dashboard?.recent_evidence.length ?? 0,
          decisions: pendingDecisionsCount,
          responses: dashboard?.response_recommendations.length ?? 0,
        },
      }),
    [dashboard, missions.length, pendingDecisionsCount],
  )

  const allZero = cards.every((card) => card.value === 0)

  return (
    <section
      className="flex h-full min-h-0 flex-col rounded-xl border border-border-subtle bg-[#0b111b]/90 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
      data-testid="operational-status-panel"
      aria-label="Estado operativo"
    >
      <div className="flex items-center gap-1.5">
        <p className="text-[13px] font-semibold text-text-primary">Estado operativo</p>
        <button
          type="button"
          onClick={() => setInfoOpen(true)}
          className="rounded-full p-0.5 text-text-tertiary transition-colors hover:text-text-secondary"
          aria-label="Qué significa esta sección"
          title="Qué significa esta sección"
        >
          <Info size={13} aria-hidden />
        </button>
      </div>

      {dashboardQuery.isLoading ? (
        <div className="mt-3 grid flex-1 grid-cols-5 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[128px] animate-pulse rounded-xl bg-surface-3/40" />
          ))}
        </div>
      ) : (
        <>
          <ul className="mt-3 grid flex-1 grid-cols-5 gap-2">
            {cards.map((card) => (
              <OperationalCard key={card.key} card={card} />
            ))}
          </ul>
          {allZero && (
            <p className="mt-2 text-[11px] text-[#9898a4]">
              No hay operaciones activas en este momento.
            </p>
          )}
        </>
      )}

      {infoOpen && <OperationalInfoDialog onClose={() => setInfoOpen(false)} />}
    </section>
  )
}
