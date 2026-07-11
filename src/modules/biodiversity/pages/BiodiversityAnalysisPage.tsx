import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { ModuleHeader } from '@/shared/components/ModuleHeader'
import { Badge } from '@/shared/components/Badge'
import { Card } from '@/shared/components/Card'
import { cn } from '@/shared/utils/cn'
import {
  buildBiodiversidadPath,
  countActiveBiodiversityFilters,
  DATA_STATUS_LABELS,
  PERIOD_LABELS,
  parseBiodiversityPageFilters,
} from '@/modules/biodiversity/api/biodiversity-page-filters'
import {
  useBiodiversityDashboard,
  useBiodiversityZoneDetail,
  useBiodiversityVisualSummary,
  useBiodiversityVisualDetail,
} from '@/modules/biodiversity/hooks/useBiodiversityDashboard'
import { BiodiversityFilters } from '@/modules/biodiversity/components/BiodiversityFilters'
import { BiodiversityZonesMap, type BiodiversityMapLayer } from '@/modules/biodiversity/components/BiodiversityZonesMap'
import { BiodiversityZonesPanel } from '@/modules/biodiversity/components/BiodiversityZonesPanel'
import { BiodiversityZoneDetailPanel } from '@/modules/biodiversity/components/BiodiversityZoneDetailPanel'
import { BiodiversityTaxonomyChart } from '@/modules/biodiversity/components/BiodiversityTaxonomyChart'
import { BiodiversityActivityChart } from '@/modules/biodiversity/components/BiodiversityActivityChart'
import { BiodiversityQualityCard } from '@/modules/biodiversity/components/BiodiversityQualityCard'
import { BiodiversityFeaturedSpecies } from '@/modules/biodiversity/components/BiodiversityFeaturedSpecies'
import { BiodiversityRecentObservationsFeed } from '@/modules/biodiversity/components/BiodiversityRecentObservationsFeed'
import { BiodiversityVisualDetailModal } from '@/modules/biodiversity/components/BiodiversityVisualDetailModal'
import type {
  BiodiversityFeaturedSpeciesDto,
  BiodiversityObservationVisual,
} from '@/modules/biodiversity/biodiversity-visual.types'
import { biodiversityVisualStatusMessage } from '@/modules/biodiversity/biodiversity-visual-status'
import { biodiversityProviderLabel } from '@/modules/biodiversity/utils/biodiversity-labels'

const MAP_LAYERS: Array<{ id: BiodiversityMapLayer; label: string }> = [
  { id: 'richness', label: 'Riqueza' },
  { id: 'recent', label: 'Actividad' },
  { id: 'quality', label: 'Calidad' },
]

export function BiodiversityAnalysisPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedZone, setSelectedZone] = useState<string | undefined>()
  const [mapLayer, setMapLayer] = useState<BiodiversityMapLayer>('richness')

  const [selectedVisual, setSelectedVisual] = useState<
    (BiodiversityObservationVisual | BiodiversityFeaturedSpeciesDto) | null
  >(null)

  const filters = useMemo(() => parseBiodiversityPageFilters(searchParams), [searchParams])
  const dashboardQuery = useBiodiversityDashboard(filters)
  const visualQuery = useBiodiversityVisualSummary(filters)
  const visualDetailSource = selectedVisual?.source
  const visualDetailId = selectedVisual?.sourceOccurrenceId
  const visualDetailQuery = useBiodiversityVisualDetail(visualDetailSource, visualDetailId, filters)
  const zoneDetailQuery = useBiodiversityZoneDetail(selectedZone, filters)

  const data = dashboardQuery.data
  const visualData = visualQuery.data
  const activeFilters = countActiveBiodiversityFilters(filters)

  const updateFilters = useCallback(
    (next: typeof filters) => {
      navigate(buildBiodiversidadPath(next), { replace: true })
    },
    [navigate],
  )

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['biodiversity'] })
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-0">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] px-6 py-8">
          <ModuleHeader
            title="Biodiversidad documentada"
            description="Observaciones agregadas de GBIF e iNaturalist en zonas monitoreadas de Guatemala"
            actions={
              <button
                type="button"
                onClick={handleRefresh}
                className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary"
                aria-label="Actualizar datos"
              >
                <RefreshCw
                  className={cn('h-3.5 w-3.5', dashboardQuery.isFetching && 'animate-spin')}
                />
                Actualizar
              </button>
            }
          />

          {dashboardQuery.isError && (
            <Card padding="md" className="mt-4 border-confidence-low/30 bg-confidence-low/5">
              <div className="flex items-start gap-2 text-sm text-text-secondary">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-confidence-low" />
                No se pudo cargar el dashboard de biodiversidad.
              </div>
            </Card>
          )}

          {data && (
            <Card padding="lg" className="mt-6 border-border-subtle bg-surface-2/60">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    Resumen de zonas monitoreadas
                  </p>
                  <p className="mt-1 text-xs text-text-tertiary">
                    {data.national_summary.zones_monitored} territorios ·{' '}
                    {PERIOD_LABELS[data.filters_applied.period]} ·{' '}
                    {data.national_summary.sources_active.join(' + ') || 'sin fuentes'}
                  </p>
                </div>
                {data.data_status !== 'success' && (
                  <Badge variant="warning">
                    {DATA_STATUS_LABELS[data.data_status] ?? data.data_status}
                  </Badge>
                )}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryMetric
                  label="Especies en período"
                  value={data.national_summary.species_count}
                  hint={data.national_summary.period_label}
                />
                <SummaryMetric
                  label={data.national_summary.truncated ? 'Observaciones (mín.)' : 'Observaciones período'}
                  value={data.national_summary.observations_count}
                  hint={
                    data.national_summary.truncated
                      ? 'Límite de consulta alcanzado (no es un error): se muestra una parte de la muestra'
                      : 'En la ventana seleccionada'
                  }
                />
                <SummaryMetric
                  label="Recientes 30 días"
                  value={data.national_summary.recent_30d_count}
                  hint="Dentro de la muestra consultada"
                />
                <SummaryMetric
                  label="Generalizados"
                  value={data.national_summary.generalized_count}
                  hint="Ubicación oculta o generalizada"
                />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-text-secondary">
                {data.national_summary.narrative}
              </p>
            </Card>
          )}

          <div className="mt-6">
            <BiodiversityFilters
              filters={filters}
              onChange={updateFilters}
              activeCount={activeFilters}
            />
          </div>

          <Card padding="lg" className="mt-6 border-border-subtle bg-surface-2/50">
            <p className="text-sm font-semibold text-text-primary">Especies destacadas</p>
            <p className="mt-1 text-xs text-text-tertiary">
              Evidencia fotográfica con licencia utilizable ·{' '}
              {biodiversityVisualStatusMessage(visualData, {
                isLoading: visualQuery.isLoading,
                isError: visualQuery.isError,
              })}
            </p>
            {visualQuery.isError && (
              <p className="mt-2 text-xs text-confidence-low">
                Error al cargar la capa visual. Use actualizar para reintentar.
              </p>
            )}
            <div className="mt-4">
              <BiodiversityFeaturedSpecies
                species={visualData?.featured_species ?? []}
                isLoading={visualQuery.isLoading}
                emptyMessage={
                  !visualQuery.isLoading && !visualQuery.isError
                    ? biodiversityVisualStatusMessage(visualData, {})
                    : undefined
                }
                onSelect={setSelectedVisual}
              />
            </div>
          </Card>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card padding="md" className="border-border-subtle bg-surface-2/50">
              <p className="mb-3 text-sm font-medium text-text-primary">Observaciones recientes</p>
              <BiodiversityRecentObservationsFeed
                observations={visualData?.recent_observations ?? []}
                isLoading={visualQuery.isLoading}
                onSelect={setSelectedVisual}
              />
            </Card>
            <Card padding="md" className="border-border-subtle bg-surface-2/50">
              <p className="mb-3 text-sm font-medium text-text-primary">
                Territorios con evidencia visual
              </p>
              <div className="space-y-3">
                {(visualData?.zone_highlights ?? []).map((z) => (
                  <div
                    key={z.zoneCode}
                    className="flex gap-3 rounded-lg border border-border-subtle bg-surface-1/40 p-3"
                  >
                    {z.coverThumbnailUrl ? (
                      <img
                        src={z.coverThumbnailUrl}
                        alt={z.zoneName}
                        className="h-14 w-14 rounded-md object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-md bg-surface-3 text-[10px] text-text-tertiary">
                        Sin foto
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary">{z.zoneName}</p>
                      <p className="text-xs text-text-secondary">
                        {z.speciesCount} especies · {z.observationsCount} obs. · {z.recentCount}{' '}
                        recientes
                      </p>
                      <p className="mt-1 text-[10px] text-text-tertiary line-clamp-2">{z.narrative}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-stretch">
            <div className="flex flex-col gap-3 lg:w-[65%]">
              <div className="flex gap-2">
                {MAP_LAYERS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setMapLayer(l.id)}
                    className={cn(
                      'rounded-md px-3 py-1 text-xs font-medium',
                      mapLayer === l.id
                        ? 'bg-accent-subtle text-accent'
                        : 'bg-surface-2 text-text-tertiary hover:text-text-secondary',
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <BiodiversityZonesMap
                zones={data?.zones ?? []}
                selectedZoneCode={selectedZone}
                layer={mapLayer}
                onSelectZone={setSelectedZone}
                isLoading={dashboardQuery.isLoading}
                isError={dashboardQuery.isError}
              />
            </div>

            <div className="flex flex-col gap-3 lg:w-[35%] lg:max-h-[420px] lg:overflow-y-auto">
              <BiodiversityZonesPanel
                zones={data?.zones ?? []}
                selectedZoneCode={selectedZone}
                onSelectZone={setSelectedZone}
                isLoading={dashboardQuery.isLoading}
              />
              {selectedZone && (
                <BiodiversityZoneDetailPanel
                  detail={zoneDetailQuery.data}
                  isLoading={zoneDetailQuery.isLoading}
                  onClose={() => setSelectedZone(undefined)}
                />
              )}
            </div>
          </div>

          {data && (
            <div className="mt-6 grid gap-4 lg:grid-cols-10">
              <Card padding="md" className="bg-surface-2/60 lg:col-span-4 lg:max-h-[280px] lg:overflow-y-auto">
                <p className="mb-3 text-sm font-medium text-text-primary">
                  Distribución taxonómica de la muestra
                </p>
                <BiodiversityTaxonomyChart distribution={data.taxonomic_distribution} />
              </Card>
              <Card padding="md" className="bg-surface-2/60 lg:col-span-3 lg:max-h-[280px]">
                <p className="mb-3 text-sm font-medium text-text-primary">Actividad semanal</p>
                <BiodiversityActivityChart activity={data.activity} />
              </Card>
              <Card padding="md" className="bg-surface-2/60 lg:col-span-3 lg:max-h-[280px] lg:overflow-y-auto">
                <p className="mb-3 text-sm font-medium text-text-primary">Calidad y fuentes</p>
                <div className="mb-3 space-y-1">
                  {data.sources.map((s) => (
                    <div
                      key={s.provider}
                      className="flex items-center justify-between text-xs text-text-secondary"
                    >
                      <span>{biodiversityProviderLabel(s.provider)}</span>
                      <span>
                        {s.records} reg. · {s.reachable ? 'OK' : 'no disponible'}
                      </span>
                    </div>
                  ))}
                </div>
                <BiodiversityQualityCard quality={data.quality} />
              </Card>
            </div>
          )}
        </div>
      </div>

      <BiodiversityVisualDetailModal
        detail={visualDetailQuery.data}
        fallback={selectedVisual}
        isLoading={visualDetailQuery.isLoading}
        onClose={() => setSelectedVisual(null)}
      />
    </div>
  )
}

function SummaryMetric({
  label,
  value,
  hint,
}: {
  label: string
  value: number
  hint?: string
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-1/40 px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-text-tertiary">{label}</p>
      <p className="text-xl font-semibold text-text-primary">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-text-tertiary">{hint}</p>}
    </div>
  )
}
