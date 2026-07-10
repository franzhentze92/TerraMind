import { useEffect, useState } from 'react'
import { X, MapPin, Download, Flag, CheckCircle2, Eye } from 'lucide-react'
import type { FireEventDetailDto } from '@/modules/fires/types/fire.dto'
import { Badge } from '@/shared/components/Badge'
import { cn } from '@/shared/utils/cn'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'
import { riskLevelLabel } from '@/modules/fires/utils/format'
import {
  eventStatusLabel,
  riskBadgeVariant,
  validationStatusLabel,
} from '@/modules/fires/utils/fire-interpretation'
import { FireEvidenceTimeline } from './FireEvidenceTimeline'
import { FireLandCoverSection } from './FireLandCoverSection'
import {
  buildTerritorySummaryText,
  territoryDisclaimer,
  territoryStatusLabel,
} from '@/modules/fires/utils/protected-area-summary'
import {
  formatDistanceM,
  proximityLabelText,
} from '@/modules/fires/utils/proximity-label'

type DetailTab = 'resumen' | 'evidencia' | 'analisis' | 'territorio'

interface FireEventDetailPanelProps {
  event?: FireEventDetailDto
  isLoading?: boolean
  isError?: boolean
  notFound?: boolean
  onClose: () => void
  className?: string
}

const TABS: { id: DetailTab; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'evidencia', label: 'Evidencia' },
  { id: 'territorio', label: 'Territorio' },
  { id: 'analisis', label: 'Análisis' },
]

function DisabledAction({ icon: Icon, label }: { icon: typeof MapPin; label: string }) {
  return (
    <button
      type="button"
      disabled
      title="Próximamente"
      className="flex items-center gap-1.5 rounded-md border border-border-subtle px-2.5 py-1.5 text-[11px] text-text-tertiary"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

export function FireEventDetailPanel({
  event,
  isLoading,
  isError,
  notFound,
  onClose,
  className,
}: FireEventDetailPanelProps) {
  const [tab, setTab] = useState<DetailTab>('resumen')

  useEffect(() => {
    setTab('resumen')
  }, [event?.id])

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-border-subtle bg-surface-1 lg:border-l',
        className,
      )}
      aria-label="Detalle del evento térmico"
    >
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <p className="text-sm font-semibold text-text-primary">Detalle del evento</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar detalle"
          className="rounded-md p-1 text-text-tertiary hover:bg-surface-3 hover:text-text-primary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {event && !isLoading && (
        <div className="border-b border-border-subtle px-4 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-text-primary">
              {event.department_name ?? 'Sin departamento'}
            </h2>
            <Badge variant={riskBadgeVariant(event.risk_level)}>
              {riskLevelLabel(event.risk_level)}
            </Badge>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 pb-3">
            <Badge variant="default">{eventStatusLabel(event.status)}</Badge>
            <Badge variant="accent">{validationStatusLabel(event.validation_status)}</Badge>
          </div>

          <div
            className="flex gap-1 pb-0"
            role="tablist"
            aria-label="Secciones del detalle"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'rounded-t-md px-3 py-2 text-xs font-medium transition-colors',
                  tab === t.id
                    ? 'border border-b-0 border-border-subtle bg-surface-1 text-text-primary'
                    : 'text-text-tertiary hover:text-text-secondary',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading && (
          <div className="space-y-3 animate-pulse">
            <div className="h-6 w-2/3 rounded bg-surface-3" />
            <div className="h-24 rounded bg-surface-3" />
            <div className="h-32 rounded bg-surface-3" />
          </div>
        )}

        {isError && (
          <p className="text-sm text-confidence-low">
            No se pudo cargar el detalle del evento.
          </p>
        )}

        {notFound && (
          <p className="text-sm text-text-secondary">Evento no encontrado.</p>
        )}

        {event && !isLoading && (
          <div role="tabpanel">
            {tab === 'resumen' && (
              <section className="space-y-4">
                <dl className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-text-tertiary">Detecciones</dt>
                    <dd className="font-mono text-text-primary">{event.detection_count}</dd>
                  </div>
                  <div>
                    <dt className="text-text-tertiary">Satélites</dt>
                    <dd className="font-mono text-text-primary">{event.satellite_count}</dd>
                  </div>
                  <div>
                    <dt className="text-text-tertiary">Primera detección</dt>
                    <dd className="text-text-secondary">
                      {formatGuatemalaDateTime(event.first_detected_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-tertiary">Última detección</dt>
                    <dd className="text-text-secondary">
                      {formatGuatemalaDateTime(event.last_detected_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-tertiary">Persistencia</dt>
                    <dd className="text-text-secondary">
                      {event.persistence_hours != null ? `${event.persistence_hours} h` : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-tertiary">FRP máximo</dt>
                    <dd className="font-mono text-text-primary">
                      {event.max_frp_mw != null ? `${event.max_frp_mw.toFixed(2)} MW` : '—'}
                    </dd>
                  </div>
                </dl>
                <p className="text-[11px] leading-relaxed text-text-tertiary">
                  {event.evidence_summary}
                </p>
              </section>
            )}

            {tab === 'evidencia' && (
              <section>
                <FireEvidenceTimeline detections={event.detections} />
              </section>
            )}

            {tab === 'analisis' && (
              <section className="space-y-4">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                    Interpretación
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                    {event.interpretation}
                  </p>
                </div>

                {event.estimated_area_ha != null && (
                  <details className="rounded-lg border border-border-subtle bg-surface-2/40 px-3 py-2 text-xs">
                    <summary className="cursor-pointer text-text-secondary hover:text-text-primary">
                      Ver detalles geométricos
                    </summary>
                    <div className="mt-3 border-t border-border-subtle pt-3">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                        Cobertura geométrica de visualización
                      </p>
                      <p className="mt-1 font-mono text-sm text-text-secondary">
                        {event.estimated_area_ha.toFixed(2)} ha
                      </p>
                      <p className="mt-2 text-[11px] leading-relaxed text-text-tertiary">
                        {event.area_disclaimer}
                      </p>
                    </div>
                  </details>
                )}
              </section>
            )}

            {tab === 'territorio' && (
              <section className="space-y-4">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                    Áreas protegidas
                  </p>
                  {event.protected_area_context ? (
                    <div className="mt-3 space-y-3 text-sm">
                      <p className="leading-relaxed text-text-secondary">
                        {buildTerritorySummaryText(event.protected_area_context)}
                      </p>
                      {territoryDisclaimer(event.protected_area_context.inside_protected_area) && (
                        <p className="text-[11px] leading-relaxed text-text-tertiary">
                          {territoryDisclaimer(event.protected_area_context.inside_protected_area)}
                        </p>
                      )}
                      <dl className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <dt className="text-text-tertiary">Estado</dt>
                          <dd className="text-text-primary">
                            {territoryStatusLabel(event.protected_area_context.inside_protected_area)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-text-tertiary">Detecciones dentro</dt>
                          <dd className="font-mono text-text-primary">
                            {event.protected_area_context.detections_inside_count}
                          </dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-text-tertiary">Áreas intersectadas</dt>
                          <dd className="text-text-secondary">
                            {event.protected_area_context.intersecting_areas.length > 0
                              ? event.protected_area_context.intersecting_areas
                                  .map((a) => a.display_name)
                                  .join(', ')
                              : 'Ninguna'}
                          </dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-text-tertiary">
                            {event.protected_area_context.inside_protected_area
                              ? 'Área protegida asociada'
                              : 'Área protegida más cercana'}
                          </dt>
                          <dd className="text-text-secondary">
                            {event.protected_area_context.inside_protected_area
                              ? event.protected_area_context.intersecting_areas
                                  .map((a) => a.display_name)
                                  .join(', ') || '—'
                              : event.protected_area_context.nearest_area?.display_name ?? '—'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-text-tertiary">Distancia</dt>
                          <dd className="font-mono text-text-primary">
                            {formatDistanceM(
                              event.protected_area_context.nearest_area?.distance_m,
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-text-tertiary">Proximidad</dt>
                          <dd className="text-text-secondary">
                            {event.protected_area_context.nearest_area
                              ? proximityLabelText(
                                  event.protected_area_context.nearest_area.proximity_label,
                                )
                              : '—'}
                          </dd>
                        </div>
                        {event.protected_area_context.diagnostic_geometry_intersects_protected_area && (
                          <div className="col-span-2">
                            <dt className="text-text-tertiary">Superposición diagnóstica</dt>
                            <dd className="text-[11px] text-text-tertiary">
                              El buffer de visualización (~375 m) intersecta un área protegida.
                              Esto no confirma presencia satelital dentro del polígono.
                            </dd>
                          </div>
                        )}
                        <div className="col-span-2">
                          <dt className="text-text-tertiary">Fuente</dt>
                          <dd className="text-text-secondary">
                            {event.protected_area_context.source_name} (
                            {event.protected_area_context.source_version})
                          </dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-text-tertiary">Fecha del contexto</dt>
                          <dd className="text-text-secondary">
                            {event.protected_area_context.generated_at
                              ? formatGuatemalaDateTime(event.protected_area_context.generated_at)
                              : '—'}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-text-tertiary">
                      Contexto territorial no calculado.
                    </p>
                  )}
                </div>

                <FireLandCoverSection context={event.land_cover_context} />
              </section>
            )}

            <section className="mt-6 flex flex-wrap gap-2 border-t border-border-subtle pt-4">
              <DisabledAction icon={Eye} label="Marcar para revisión" />
              <DisabledAction icon={CheckCircle2} label="Validar evento" />
              <DisabledAction icon={MapPin} label="Ver en mapa" />
              <DisabledAction icon={Download} label="Descargar evidencia" />
              <DisabledAction icon={Flag} label="Crear hallazgo" />
            </section>
          </div>
        )}
      </div>
    </aside>
  )
}
