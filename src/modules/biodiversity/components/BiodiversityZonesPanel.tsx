import type { BiodiversityDashboardZoneItem } from '@/modules/biodiversity/types/biodiversity-dashboard.types'
import { DATA_STATUS_LABELS } from '@/modules/biodiversity/api/biodiversity-page-filters'
import { Badge } from '@/shared/components/Badge'
import { cn } from '@/shared/utils/cn'

interface BiodiversityZonesPanelProps {
  zones: BiodiversityDashboardZoneItem[]
  selectedZoneCode?: string
  onSelectZone: (zoneCode: string) => void
  isLoading?: boolean
  className?: string
}

export function BiodiversityZonesPanel({
  zones,
  selectedZoneCode,
  onSelectZone,
  isLoading,
  className,
}: BiodiversityZonesPanelProps) {
  if (isLoading) {
    return (
      <div className={cn('space-y-2', className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-surface-3" />
        ))}
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-sm font-medium text-text-primary">Territorios monitoreados</p>
      {zones.map((zone) => {
        const selected = zone.zone_code === selectedZoneCode
        return (
          <button
            key={zone.zone_code}
            type="button"
            onClick={() => onSelectZone(zone.zone_code)}
            className={cn(
              'w-full rounded-lg border px-4 py-3 text-left transition-colors',
              selected
                ? 'border-accent/50 bg-accent-subtle/30'
                : 'border-border-subtle bg-surface-2/60 hover:bg-surface-2',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-text-primary">{zone.zone_name}</p>
                <p className="text-xs text-text-tertiary">{zone.region_label}</p>
              </div>
              {zone.data_status !== 'success' && (
                <Badge variant="warning" className="shrink-0 text-[10px]">
                  {DATA_STATUS_LABELS[zone.data_status] ?? zone.data_status}
                </Badge>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-secondary">
              <span>{zone.species_count} especies</span>
              <span>·</span>
              <span>{zone.observations_count} obs.</span>
              <span>·</span>
              <span>{zone.recent_count} recientes</span>
            </div>
            {zone.top_taxonomic_groups.length > 0 && (
              <p className="mt-1 text-[10px] text-text-tertiary">
                {zone.top_taxonomic_groups.join(', ')}
              </p>
            )}
          </button>
        )
      })}
    </div>
  )
}
