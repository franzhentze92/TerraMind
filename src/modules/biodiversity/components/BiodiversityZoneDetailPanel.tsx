import { useState } from 'react'
import { X } from 'lucide-react'
import type { BiodiversityZoneDetailDto } from '@/modules/biodiversity/types/biodiversity-dashboard.types'
import { BiodiversityTaxonomyChart } from '@/modules/biodiversity/components/BiodiversityTaxonomyChart'
import { BiodiversityActivityChart } from '@/modules/biodiversity/components/BiodiversityActivityChart'
import { BiodiversityQualityCard } from '@/modules/biodiversity/components/BiodiversityQualityCard'
import { cn } from '@/shared/utils/cn'

type TabId = 'resumen' | 'taxonomia' | 'actividad' | 'calidad'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'taxonomia', label: 'Taxonomía' },
  { id: 'actividad', label: 'Actividad' },
  { id: 'calidad', label: 'Calidad' },
]

interface BiodiversityZoneDetailPanelProps {
  detail?: BiodiversityZoneDetailDto
  isLoading?: boolean
  onClose: () => void
  className?: string
}

export function BiodiversityZoneDetailPanel({
  detail,
  isLoading,
  onClose,
  className,
}: BiodiversityZoneDetailPanelProps) {
  const [tab, setTab] = useState<TabId>('resumen')

  if (isLoading) {
    return (
      <div className={cn('rounded-xl border border-border-subtle bg-surface-2/80 p-5', className)}>
        <div className="h-4 w-40 animate-pulse rounded bg-surface-3" />
        <div className="mt-4 h-24 animate-pulse rounded bg-surface-3" />
      </div>
    )
  }

  if (!detail) return null

  return (
    <div className={cn('rounded-xl border border-border-subtle bg-surface-2/80', className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-text-primary">{detail.zone_name}</p>
          <p className="text-xs text-text-tertiary">{detail.region_label}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-text-tertiary hover:bg-surface-3 hover:text-text-primary"
          aria-label="Cerrar detalle"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-1 border-b border-border-subtle px-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'px-3 py-2 text-xs font-medium transition-colors',
              tab === t.id
                ? 'border-b-2 border-accent text-text-primary'
                : 'text-text-tertiary hover:text-text-secondary',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === 'resumen' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Especies" value={detail.summary.species_count} />
              <Stat label="Observaciones" value={detail.summary.observations_count} />
              <Stat label="Recientes" value={detail.summary.recent_count} />
              <Stat label="Research grade" value={detail.summary.research_grade_count} />
            </div>
            <p className="text-sm leading-relaxed text-text-secondary">{detail.summary.narrative}</p>
            <p className="text-xs text-text-tertiary">{detail.disclaimer}</p>
          </div>
        )}
        {tab === 'taxonomia' && (
          <BiodiversityTaxonomyChart distribution={detail.taxonomic_distribution} />
        )}
        {tab === 'actividad' && <BiodiversityActivityChart activity={detail.activity} />}
        {tab === 'calidad' && <BiodiversityQualityCard quality={detail.quality} />}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border-subtle bg-surface-1/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-text-tertiary">{label}</p>
      <p className="text-lg font-semibold text-text-primary">{value}</p>
    </div>
  )
}
