import { FIRMS_INGEST_SOURCES } from '@/pipeline/connectors/firms.config'
import type { FireDepartmentOptionDto } from '@/modules/fires/types/fire.dto'
import type { FirePageFilters } from '@/modules/fires/api/fire-page-filters'
import { countActiveFilters } from '@/modules/fires/api/fire-page-filters'
import { sourceProductDisplayName } from '@/modules/fires/utils/source-labels'
import { pluralizeCount } from '@/modules/fires/utils/thermal-labels'
import { cn } from '@/shared/utils/cn'

interface FireFiltersProps {
  filters: FirePageFilters
  departments: FireDepartmentOptionDto[]
  resultCount?: number
  onChange: (next: FirePageFilters) => void
  onClear: () => void
}

const PERIODS = [
  { value: '24h' as const, label: '24 h' },
  { value: '48h' as const, label: '48 h' },
  { value: '7d' as const, label: '7 días' },
]

const selectClass =
  'rounded-md border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none'

export function FireFilters({
  filters,
  departments,
  resultCount,
  onChange,
  onClear,
}: FireFiltersProps) {
  const active = countActiveFilters(filters)

  function patch(partial: Partial<FirePageFilters>) {
    onChange({ ...filters, ...partial, page: 1 })
  }

  return (
    <div className="space-y-3 rounded-xl border border-border-subtle bg-surface-2/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-text-secondary">Filtros</p>
        <div className="flex items-center gap-3 text-xs text-text-tertiary">
          {resultCount !== undefined && (
            <span aria-live="polite">
              {pluralizeCount(resultCount, 'resultado', 'resultados')}
            </span>
          )}
          {active > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="font-medium text-accent hover:text-text-primary"
            >
              Limpiar filtros ({active})
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => patch({ period: p.value })}
            className={cn(
              'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
              filters.period === p.value
                ? 'border-accent bg-accent-subtle text-accent'
                : 'border-border-subtle text-text-secondary hover:text-text-primary',
            )}
            aria-pressed={filters.period === p.value}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <select
          aria-label="Departamento"
          className={selectClass}
          value={filters.department_code ?? ''}
          onChange={(e) => patch({ department_code: e.target.value || undefined })}
        >
          <option value="">Todos los departamentos</option>
          {departments.map((d) => (
            <option key={d.code} value={d.code}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Nivel de riesgo"
          className={selectClass}
          value={filters.risk_level ?? ''}
          onChange={(e) => patch({ risk_level: e.target.value || undefined })}
        >
          <option value="">Todo riesgo</option>
          <option value="informativo">Informativo</option>
          <option value="observacion">Observación</option>
          <option value="atencion">Atención</option>
          <option value="alto">Alto</option>
          <option value="critico">Crítico</option>
        </select>

        <select
          aria-label="Estado del evento"
          className={selectClass}
          value={filters.status ?? ''}
          onChange={(e) => patch({ status: e.target.value || undefined })}
        >
          <option value="">Todo estado</option>
          <option value="new">Nuevo</option>
          <option value="active">Activo</option>
          <option value="monitoring">En observación</option>
          <option value="closed">Cerrado</option>
        </select>

        <select
          aria-label="Validación"
          className={selectClass}
          value={filters.validation_status ?? ''}
          onChange={(e) => patch({ validation_status: e.target.value || undefined })}
        >
          <option value="">Toda validación</option>
          <option value="no_validado">No validado</option>
          <option value="probable">Probable</option>
          <option value="confirmado">Confirmado</option>
        </select>

        <select
          aria-label="Fuente satelital"
          className={selectClass}
          value={filters.source_product ?? ''}
          onChange={(e) => patch({ source_product: e.target.value || undefined })}
        >
          <option value="">Todas las fuentes</option>
          {FIRMS_INGEST_SOURCES.map((s) => (
            <option key={s} value={s}>
              {sourceProductDisplayName(s)}
            </option>
          ))}
        </select>

        <input
          aria-label="Prioridad mínima"
          type="number"
          min={0}
          max={100}
          placeholder="Prioridad mín."
          className={selectClass}
          value={filters.min_priority ?? ''}
          onChange={(e) => {
            const v = e.target.value
            patch({ min_priority: v === '' ? undefined : Number(v) })
          }}
        />
      </div>
    </div>
  )
}
