import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { ModuleHeader } from '@/shared/components/ModuleHeader'
import { Badge } from '@/shared/components/Badge'
import { useFireSummaryForPeriod } from '@/modules/fires/hooks/useFireSummary'
import { useFireEvents, useFireDepartments } from '@/modules/fires/hooks/useFireEvents'
import { useFireEvent } from '@/modules/fires/hooks/useFireEvent'
import {
  useFireDetectionsGeoJson,
  useFireEventsGeoJson,
} from '@/modules/fires/hooks/useFireGeoJson'
import {
  DEFAULT_FIRE_PAGE_FILTERS,
  buildIncendiosPath,
  parsePageFilters,
} from '@/modules/fires/api/fire-page-filters'
import type { FirePageFilters } from '@/modules/fires/api/fire-page-filters'
import { FIRE_EVENTS_DEFAULT_LIMIT } from '@/modules/fires/config/fire.constants'
import { formatGuatemalaTime, formatRelativeMinutes } from '@/modules/fires/utils/format'
import { FireSummaryStrip } from '@/modules/fires/components/FireSummaryStrip'
import { FireFilters } from '@/modules/fires/components/FireFilters'
import { FireEventsTable } from '@/modules/fires/components/FireEventsTable'
import { FireEventDetailPanel } from '@/modules/fires/components/FireEventDetailPanel'
import { FireEventsMap } from '@/modules/fires/components/FireEventsMap'
import { Switch } from '@/shared/components/Switch'
import { FirePipelineStatusLine } from '@/modules/fires/components/FirePipelineStatusLine'
import { useFirePipelineHealth } from '@/modules/fires/hooks/useFirePipelineHealth'
import { ApiError } from '@/core/api/client'
import { cn } from '@/shared/utils/cn'

export function FireAnalysisPage() {
  const { eventId } = useParams<{ eventId?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showDetections, setShowDetections] = useState(false)

  const filters = useMemo(
    () => parsePageFilters(searchParams),
    [searchParams],
  )

  const summaryQuery = useFireSummaryForPeriod(filters.period)
  const eventsQuery = useFireEvents(filters)
  const geoJsonQuery = useFireEventsGeoJson(filters)
  const detectionsGeoJsonQuery = useFireDetectionsGeoJson(filters, showDetections)
  const departmentsQuery = useFireDepartments()
  const eventQuery = useFireEvent(eventId)
  const pipelineHealthQuery = useFirePipelineHealth()

  const summary = summaryQuery.data
  const ds = summary?.data_status
  const items = eventsQuery.data?.items ?? []
  // Counter must never report fewer results than the rows actually visible.
  const total = Math.max(eventsQuery.data?.pagination.total ?? 0, items.length)
  const limit = eventsQuery.data?.pagination.limit ?? FIRE_EVENTS_DEFAULT_LIMIT
  const offset = eventsQuery.data?.pagination.offset ?? 0
  const rangeStart = total === 0 ? 0 : offset + 1
  const rangeEnd = Math.min(offset + limit, total)
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const updateFilters = useCallback(
    (next: FirePageFilters) => {
      const path = buildIncendiosPath(next, eventId)
      navigate(path, { replace: true })
    },
    [eventId, navigate],
  )

  const handleSelectEvent = (id: string) => {
    navigate(buildIncendiosPath(filters, id))
  }

  const handleCloseDetail = () => {
    navigate(buildIncendiosPath(filters))
  }

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['fires'] })
  }

  const handlePage = (page: number) => {
    updateFilters({ ...filters, page })
  }

  const notFound = eventQuery.error instanceof ApiError && eventQuery.error.status === 404

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-0">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] px-6 py-8">
          <ModuleHeader
            title="Incendios y focos de calor"
            description="Detecciones satelitales y eventos térmicos identificados en Guatemala"
            actions={
              <button
                type="button"
                onClick={handleRefresh}
                className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary"
                aria-label="Actualizar datos"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', summaryQuery.isFetching && 'animate-spin')} />
                Actualizar
              </button>
            }
          />

          <div className="mt-4 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3 text-xs text-text-tertiary">
              <span>Ventana: {filters.period}</span>
            {ds && (
              <>
                <span>·</span>
                <span>
                  Ingesta FIRMS: {formatRelativeMinutes(ds.last_firms_ingestion_at) ?? '—'}
                </span>
                <span>·</span>
                <span>
                  Última adquisición:{' '}
                  {ds.latest_satellite_acquisition_at
                    ? formatGuatemalaTime(ds.latest_satellite_acquisition_at)
                    : '—'}
                </span>
                <span>·</span>
                <span>
                  Proveedores FIRMS: {ds.sources_queried_successfully} de {ds.sources_expected}{' '}
                  operativos
                </span>
              </>
            )}
            {ds?.is_stale && (
              <Badge variant="warning">Datos desactualizados</Badge>
            )}
            {ds?.is_partial && (
              <Badge variant="warning">Ingesta parcial</Badge>
            )}
            </div>
            <FirePipelineStatusLine
              health={pipelineHealthQuery.data}
              isLoading={pipelineHealthQuery.isLoading}
            />
          </div>

          <div className="mt-6">
            <FireSummaryStrip summary={summary} isLoading={summaryQuery.isLoading} />
          </div>

          <div className="mt-6">
            <FireFilters
              filters={filters}
              departments={departmentsQuery.data?.items ?? []}
              resultCount={total}
              onChange={updateFilters}
              onClear={() => updateFilters({ ...DEFAULT_FIRE_PAGE_FILTERS })}
            />
          </div>

          <div
            className={cn(
              'mt-6 flex flex-col gap-4',
              eventId && 'lg:flex-row lg:items-start',
            )}
          >
            <div
              className={cn(
                'flex min-w-0 flex-col gap-2',
                eventId ? 'lg:flex-[1.65]' : 'w-full',
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-text-secondary">
                  <Switch
                    id="fire-detections-toggle"
                    checked={showDetections}
                    onChange={setShowDetections}
                    aria-label="Mostrar detecciones satelitales en el mapa"
                  />
                  <label htmlFor="fire-detections-toggle" className="cursor-pointer select-none">
                    Detecciones satelitales
                  </label>
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                      showDetections
                        ? 'bg-accent/15 text-accent'
                        : 'bg-surface-3 text-text-tertiary',
                    )}
                  >
                    {showDetections ? 'ON' : 'OFF'}
                  </span>
                  <span
                    className="hidden text-text-tertiary sm:inline"
                    title="Puntos individuales observados por los sensores. No representan incendios confirmados."
                  >
                    ⓘ
                  </span>
                </div>
                <p className="hidden text-[10px] text-text-tertiary md:block">
                  <span className="mr-3">● Evento térmico</span>
                  <span>○ Detección satelital</span>
                </p>
              </div>

              <FireEventsMap
                eventsGeoJson={geoJsonQuery.data}
                detectionsGeoJson={detectionsGeoJsonQuery.data}
                eventListItems={items}
                showDetections={showDetections}
                selectedEventId={eventId}
                selectedEventLandCover={eventQuery.data?.land_cover_context}
                isLoading={geoJsonQuery.isLoading}
                isError={geoJsonQuery.isError}
                onSelectEvent={handleSelectEvent}
                onViewDetail={handleSelectEvent}
                className={cn(
                  eventId
                    ? 'h-[min(520px,max(480px,40vh))]'
                    : 'h-[460px]',
                )}
              />
            </div>

            {eventId && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                  onClick={handleCloseDetail}
                  aria-hidden
                />
                <FireEventDetailPanel
                  event={eventQuery.data}
                  isLoading={eventQuery.isLoading}
                  isError={eventQuery.isError && !notFound}
                  notFound={notFound}
                  onClose={handleCloseDetail}
                  className={cn(
                    'fixed inset-0 z-50 w-full shadow-xl',
                    'md:inset-y-0 md:right-0 md:left-auto md:max-w-lg',
                    'lg:static lg:z-auto lg:flex-[1] lg:min-w-[320px] lg:max-w-none lg:shadow-none',
                    'lg:sticky lg:top-[88px] lg:max-h-[calc(100vh-112px)] lg:overflow-y-auto',
                  )}
                />
              </>
            )}
          </div>

          <div className="mt-6">
            {eventsQuery.isLoading && (
              <div className="h-48 animate-pulse rounded-xl bg-surface-3" />
            )}

            {eventsQuery.isError && (
              <div className="flex items-start gap-3 rounded-xl border border-confidence-low/30 bg-confidence-low/5 p-4">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-confidence-low" />
                <p className="text-sm text-text-secondary">
                  No se pudo cargar la lista de eventos.
                </p>
              </div>
            )}

            {!eventsQuery.isLoading && !eventsQuery.isError && items.length === 0 && (
              <div className="rounded-xl border border-border-subtle bg-surface-2/40 p-8 text-center">
                <p className="text-sm text-text-secondary">
                  {total === 0 && filters.period === '48h'
                    ? 'No se detectaron eventos térmicos en la ventana seleccionada.'
                    : 'Ningún evento coincide con los filtros aplicados.'}
                </p>
              </div>
            )}

            {items.length > 0 && (
              <>
                <FireEventsTable
                  items={items}
                  selectedId={eventId}
                  compact={Boolean(eventId)}
                  onSelect={handleSelectEvent}
                />

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-text-tertiary">
                  <span>
                    {rangeStart}–{rangeEnd} de {total} evento{total === 1 ? '' : 's'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={filters.page <= 1}
                      onClick={() => handlePage(filters.page - 1)}
                      className="rounded-md border border-border-subtle px-3 py-1.5 disabled:opacity-40"
                    >
                      Anterior
                    </button>
                    <span>
                      Página {filters.page} de {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={filters.page >= totalPages}
                      onClick={() => handlePage(filters.page + 1)}
                      className="rounded-md border border-border-subtle px-3 py-1.5 disabled:opacity-40"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
