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
  parseBiodiversityPageFilters,
} from '@/modules/biodiversity/api/biodiversity-page-filters'
import {
  useBiodiversityDashboard,
  useBiodiversityZoneDetail,
} from '@/modules/biodiversity/hooks/useBiodiversityDashboard'
import { BiodiversityFilters } from '@/modules/biodiversity/components/BiodiversityFilters'
import { BiodiversityZonesMap, type BiodiversityMapLayer } from '@/modules/biodiversity/components/BiodiversityZonesMap'
import { BiodiversityZonesPanel } from '@/modules/biodiversity/components/BiodiversityZonesPanel'
import { BiodiversityZoneDetailPanel } from '@/modules/biodiversity/components/BiodiversityZoneDetailPanel'
import { BiodiversityTaxonomyChart } from '@/modules/biodiversity/components/BiodiversityTaxonomyChart'
import { BiodiversityActivityChart } from '@/modules/biodiversity/components/BiodiversityActivityChart'
import { BiodiversityQualityCard } from '@/modules/biodiversity/components/BiodiversityQualityCard'

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

  const filters = useMemo(() => parseBiodiversityPageFilters(searchParams), [searchParams])
  const dashboardQuery = useBiodiversityDashboard(filters)
  const zoneDetailQuery = useBiodiversityZoneDetail(selectedZone, filters)

  const data = dashboardQuery.data
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
                  <p className="text-sm font-semibold text-text-primary">Resumen nacional</p>
                  <p className="mt-1 text-xs text-text-tertiary">
                    {data.national_summary.zones_monitored} zonas ·{' '}
                    {data.national_summary.sources_active.join(' + ') || 'sin fuentes'}
                  </p>
                </div>
                {data.data_status !== 'success' && (
                  <Badge variant="warning">
                    {DATA_STATUS_LABELS[data.data_status] ?? data.data_status}
                  </Badge>
                )}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryMetric label="Especies" value={data.national_summary.species_count} />
                <SummaryMetric label="Observaciones" value={data.national_summary.observations_count} />
                <SummaryMetric label="Recientes 30d" value={data.national_summary.recent_30d_count} />
                <SummaryMetric label="Generalizados" value={data.national_summary.generalized_count} />
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

          <div className="mt-6 flex flex-col gap-6 lg:flex-row">
            <div className="lg:w-[65%] space-y-4">
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

            <div className="lg:w-[35%] space-y-4">
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
            <div className="mt-8 grid gap-6 lg:grid-cols-3">
              <Card padding="lg" className="bg-surface-2/60">
                <p className="mb-4 text-sm font-medium text-text-primary">Taxonomía nacional</p>
                <BiodiversityTaxonomyChart distribution={data.taxonomic_distribution} />
              </Card>
              <Card padding="lg" className="bg-surface-2/60">
                <p className="mb-4 text-sm font-medium text-text-primary">Actividad</p>
                <BiodiversityActivityChart activity={data.activity} />
              </Card>
              <Card padding="lg" className="bg-surface-2/60">
                <p className="mb-4 text-sm font-medium text-text-primary">Calidad y fuentes</p>
                <div className="mb-4 space-y-2">
                  {data.sources.map((s) => (
                    <div
                      key={s.provider}
                      className="flex items-center justify-between text-xs text-text-secondary"
                    >
                      <span className="uppercase">{s.provider}</span>
                      <span>
                        {s.records} reg. · {s.reachable ? 'OK' : 'no disponible'}
                      </span>
                    </div>
                  ))}
                </div>
                <BiodiversityQualityCard
                  quality={{
                    coordinate_completeness_pct: 0,
                    research_grade_pct: 0,
                    obscured_count: data.national_summary.generalized_count,
                    captive_count: 0,
                    unknown_license_count: 0,
                    possible_duplicate_count: 0,
                    notes: [data.disclaimer],
                  }}
                />
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-1/40 px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-text-tertiary">{label}</p>
      <p className="text-xl font-semibold text-text-primary">{value}</p>
    </div>
  )
}
