import { Link } from 'react-router-dom'
import { Leaf, AlertTriangle, ChevronRight } from 'lucide-react'
import { Card } from '@/shared/components/Card'
import { Badge } from '@/shared/components/Badge'
import { cn } from '@/shared/utils/cn'
import type { BiodiversityDashboardSummaryDto } from '@/modules/biodiversity/types/biodiversity-dashboard.types'
import { DATA_STATUS_LABELS } from '@/modules/biodiversity/api/biodiversity-page-filters'

interface BiodiversityNationalSummaryCardProps {
  data?: BiodiversityDashboardSummaryDto
  isLoading?: boolean
  isError?: boolean
}

function Skeleton() {
  return (
    <Card padding="lg" className="animate-pulse bg-surface-2/60">
      <div className="h-3 w-28 rounded bg-surface-3" />
      <div className="mt-2 h-3 w-48 rounded bg-surface-3" />
      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="h-8 rounded bg-surface-3" />
        <div className="h-8 rounded bg-surface-3" />
        <div className="h-8 rounded bg-surface-3" />
      </div>
      <div className="mt-6 h-16 rounded-lg bg-surface-3" />
    </Card>
  )
}

function statusBadgeVariant(
  status: string,
): 'default' | 'warning' | 'critical' | 'accent' {
  if (status === 'providers_unavailable') return 'critical'
  if (status === 'partial' || status === 'stale' || status === 'truncated') return 'warning'
  if (status === 'no_recent_observations') return 'accent'
  return 'default'
}

export function BiodiversityNationalSummaryCard({
  data,
  isLoading,
  isError,
}: BiodiversityNationalSummaryCardProps) {
  if (isLoading) return <Skeleton />

  if (isError) {
    return (
      <Card padding="lg" className="border-confidence-low/30 bg-confidence-low/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-confidence-low" />
          <div>
            <p className="text-sm font-medium text-text-primary">Biodiversidad documentada</p>
            <p className="mt-1 text-sm text-text-secondary">
              No se pudo cargar el resumen de biodiversidad. El resto del panel sigue disponible.
            </p>
          </div>
        </div>
      </Card>
    )
  }

  if (!data) return null

  const ns = data.national_summary
  const statusLabel = DATA_STATUS_LABELS[data.data_status] ?? data.data_status

  return (
    <Card
      padding="lg"
      className={cn(
        'border-border-subtle bg-surface-2/80',
        data.data_status !== 'success' && 'border-confidence-medium/40',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Leaf className="h-4 w-4 text-accent" />
          <div>
            <p className="text-sm font-semibold text-text-primary">Biodiversidad documentada</p>
            <p className="text-xs text-text-secondary">
              Observaciones GBIF + iNaturalist · {ns.zones_monitored} zonas monitoreadas
            </p>
          </div>
        </div>
        {data.data_status !== 'success' && (
          <Badge variant={statusBadgeVariant(data.data_status)} className="shrink-0">
            {statusLabel}
          </Badge>
        )}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Especies" value={ns.species_count} />
        <Metric label="Observaciones" value={ns.observations_count} />
        <Metric label="Recientes 30d" value={ns.recent_30d_count} />
        <Metric label="Zonas" value={ns.zones_monitored} />
        <Metric label="Fuentes" value={ns.sources_active.length} />
        <Metric label="Generalizados" value={ns.generalized_count} />
      </div>

      {data.top_zone && (
        <div className="mt-5 rounded-lg border border-border-subtle bg-surface-1/50 p-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            Mayor riqueza documentada
          </p>
          <p className="mt-1 text-sm font-medium text-text-primary">{data.top_zone.zone_name}</p>
          <p className="mt-1 text-xs text-text-secondary">
            {data.top_zone.species_count} especie(s) · {data.top_zone.observations_count}{' '}
            observación(es) en la muestra
          </p>
        </div>
      )}

      <p className="mt-4 text-sm leading-relaxed text-text-secondary">{ns.narrative}</p>

      <p className="mt-3 text-xs text-text-tertiary">{data.disclaimer}</p>

      <Link
        to="/biodiversidad"
        className="mt-4 flex items-center gap-1 text-xs font-medium text-accent hover:text-text-primary"
      >
        Ver biodiversidad
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-text-primary">{value}</p>
    </div>
  )
}
