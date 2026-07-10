import { Link } from 'react-router-dom'
import { useState } from 'react'
import { ModuleHeader } from '@/shared/components'
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
  const query = useFindingsList({ status: status || undefined })

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <ModuleHeader
        title="Hallazgos"
        description="Interpretaciones compuestas derivadas de eventos y contextos persistidos, con evidencia trazable."
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

      {query.isLoading && <p className="text-sm text-text-tertiary">Cargando hallazgos…</p>}
      {query.isError && (
        <p className="text-sm text-confidence-low">No se pudieron cargar los hallazgos.</p>
      )}

      <div className="space-y-3">
        {(query.data?.items ?? []).map((item) => (
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
            </div>
          </Link>
        ))}
        {!query.isLoading && (query.data?.items.length ?? 0) === 0 && (
          <p className="text-sm text-text-tertiary">
            No hay hallazgos para los filtros seleccionados.
          </p>
        )}
      </div>
    </div>
  )
}
