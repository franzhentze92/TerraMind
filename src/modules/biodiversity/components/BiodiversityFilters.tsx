import type { BiodiversityDashboardFilters } from '@/modules/biodiversity/types/biodiversity-dashboard.types'
import {
  PERIOD_LABELS,
  QUALITY_LABELS,
  SOURCE_LABELS,
  TAXON_LABELS,
} from '@/modules/biodiversity/api/biodiversity-page-filters'
import { cn } from '@/shared/utils/cn'

interface BiodiversityFiltersProps {
  filters: BiodiversityDashboardFilters
  onChange: (filters: BiodiversityDashboardFilters) => void
  activeCount: number
  className?: string
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border-subtle bg-surface-2 px-2 py-1.5 text-xs text-text-primary"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function BiodiversityFilters({
  filters,
  onChange,
  activeCount,
  className,
}: BiodiversityFiltersProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border-subtle bg-surface-2/60 p-4',
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-text-primary">Filtros</p>
        {activeCount > 0 && (
          <span className="text-[10px] text-text-tertiary">{activeCount} activo(s)</span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SelectField
          label="Periodo"
          value={filters.period}
          options={Object.entries(PERIOD_LABELS).map(([value, label]) => ({ value, label }))}
          onChange={(period) =>
            onChange({ ...filters, period: period as BiodiversityDashboardFilters['period'] })
          }
        />
        <SelectField
          label="Fuente"
          value={filters.source}
          options={Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label }))}
          onChange={(source) =>
            onChange({ ...filters, source: source as BiodiversityDashboardFilters['source'] })
          }
        />
        <SelectField
          label="Grupo taxonómico"
          value={filters.taxon}
          options={Object.entries(TAXON_LABELS).map(([value, label]) => ({ value, label }))}
          onChange={(taxon) =>
            onChange({ ...filters, taxon: taxon as BiodiversityDashboardFilters['taxon'] })
          }
        />
        <SelectField
          label="Calidad"
          value={filters.quality}
          options={Object.entries(QUALITY_LABELS).map(([value, label]) => ({ value, label }))}
          onChange={(quality) =>
            onChange({ ...filters, quality: quality as BiodiversityDashboardFilters['quality'] })
          }
        />
        <SelectField
          label="Zona"
          value={filters.zone}
          options={[
            { value: 'all', label: 'Todas las zonas' },
            { value: 'maya', label: 'Maya' },
            { value: 'acatenango', label: 'Acatenango' },
            { value: 'manchon', label: 'Manchón Guamuchal' },
            { value: 'sierra-minas', label: 'Sierra de las Minas' },
            { value: 'atitlan', label: 'Lago Atitlán' },
          ]}
          onChange={(zone) =>
            onChange({ ...filters, zone: zone as BiodiversityDashboardFilters['zone'] })
          }
        />
      </div>
    </div>
  )
}
