import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { PageHeader, FilterEmptyState, OperationalEmptyState, OperationalListSkeleton, OperationalErrorState } from '@/shared/components'
import { Badge } from '@/shared/components/Badge'
import { useFindingsList } from '../hooks/useFindings'
import {
  findingConfidenceLabel,
  findingSeverityLabel,
  findingStatusLabel,
  findingDomainLabel,
} from '../utils/finding-labels'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'
import { cn } from '@/shared/utils/cn'

function severityVariant(
  label: string,
): 'default' | 'accent' | 'warning' | 'danger' {
  if (label === 'elevated_attention') return 'warning'
  if (label === 'attention') return 'accent'
  return 'default'
}

export function FindingsPage() {
  const [status, setStatus] = useState<string>('active')
  const [severity, setSeverity] = useState<string>('')
  const [findingType, setFindingType] = useState<string>('')
  const [confidence, setConfidence] = useState<string>('')
  const [department, setDepartment] = useState<string>('')

  const query = useFindingsList({
    status: status || undefined,
    finding_type: findingType || undefined,
    confidence: confidence || undefined,
    department_code: department || undefined,
  })

  const items = useMemo(() => {
    const raw = query.data?.items ?? []
    if (!severity) return raw
    return raw.filter((item) => item.severity_label === severity)
  }, [query.data?.items, severity])

  const hasActiveFilters = Boolean(
    severity || findingType || confidence || department || (status && status !== 'active'),
  )

  const clearFilters = () => {
    setStatus('active')
    setSeverity('')
    setFindingType('')
    setConfidence('')
    setDepartment('')
  }

  const listEmpty = !query.isLoading && !query.isError && items.length === 0

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6" data-testid="findings-page">
      <PageHeader
        title="Hallazgos"
        subtitle="Interpretaciones compuestas derivadas de eventos y contextos persistidos, con evidencia trazable."
        breadcrumbs={[
          { label: 'Situación Nacional', to: '/situacion' },
          { label: 'Hallazgos' },
        ]}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {['active', 'monitoring', 'resolved', ''].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setStatus(s)}
            className={cn(
              'rounded-md border px-3 py-1.5 text-xs',
              status === s
                ? 'border-accent bg-accent/10 text-text-primary'
                : 'border-border-subtle text-text-tertiary',
            )}
          >
            {s ? findingStatusLabel(s) : 'Todos'}
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-2 md:grid-cols-4">
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="rounded-md border border-border-subtle bg-surface-1 px-2 py-1.5 text-xs text-text-primary"
          aria-label="Filtrar por severidad"
        >
          <option value="">Todas las severidades</option>
          {['attention', 'elevated_attention', 'monitoring'].map((s) => (
            <option key={s} value={s}>
              {findingSeverityLabel(s)}
            </option>
          ))}
        </select>
        <select
          value={findingType}
          onChange={(e) => setFindingType(e.target.value)}
          className="rounded-md border border-border-subtle bg-surface-1 px-2 py-1.5 text-xs text-text-primary"
          aria-label="Filtrar por categoría"
        >
          <option value="">Todas las categorías</option>
          <option value="fire_activity">Actividad térmica</option>
          <option value="land_cover_context">Contexto de cobertura</option>
        </select>
        <select
          value={confidence}
          onChange={(e) => setConfidence(e.target.value)}
          className="rounded-md border border-border-subtle bg-surface-1 px-2 py-1.5 text-xs text-text-primary"
          aria-label="Filtrar por confianza"
        >
          <option value="">Toda confianza</option>
          {['high', 'medium', 'low'].map((c) => (
            <option key={c} value={c}>
              {findingConfidenceLabel(c)}
            </option>
          ))}
        </select>
        <input
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder="Código departamento"
          className="rounded-md border border-border-subtle bg-surface-1 px-2 py-1.5 text-xs text-text-primary"
          aria-label="Filtrar por ubicación"
        />
      </div>

      {query.isLoading && <OperationalListSkeleton />}
      {query.isError && (
        <OperationalErrorState
          title="No se pudieron cargar los hallazgos"
          explanation="Verifica tu conexión e intenta de nuevo."
          friendlyCode="FND-LIST"
          onRetry={() => void query.refetch()}
        />
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <Link
            key={item.id}
            to={`/hallazgos/${item.id}`}
            className="block rounded-lg border border-border-subtle bg-surface-2/30 p-4 hover:border-accent/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">{item.title}</h3>
                <p className="mt-1 text-xs text-text-tertiary">
                  {item.department_name ?? 'Sin departamento'} ·{' '}
                  {formatGuatemalaDateTime(item.generated_at)}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant={severityVariant(item.severity_label)}>
                  {findingSeverityLabel(item.severity_label)}
                </Badge>
                <Badge variant="default">{findingConfidenceLabel(item.confidence_level)}</Badge>
                <Badge variant="default">{findingStatusLabel(item.status)}</Badge>
              </div>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary line-clamp-2">
              {item.summary}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-text-tertiary">
              {item.source_domains.map((d) => (
                <span key={d}>{findingDomainLabel(d)}</span>
              ))}
              <span>· Entidad {item.entity_type}</span>
            </div>
            <p className="mt-2 text-[11px] text-accent/90">
              Siguiente paso: abrir detalle para ver prioridad e incidente vinculados
            </p>
          </Link>
        ))}
        {listEmpty && hasActiveFilters && (
          <FilterEmptyState resourceLabel="hallazgos" onClearFilters={clearFilters} />
        )}
        {listEmpty && !hasActiveFilters && (
          <OperationalEmptyState
            title="No hay hallazgos activos"
            explanation="Los hallazgos se generan cuando TerraMind interpreta eventos y contextos territoriales."
            sourceProcess="Eventos → interpretación compuesta"
            status="pending"
          />
        )}
      </div>
    </div>
  )
}
