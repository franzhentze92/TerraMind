import { Link } from 'react-router-dom'
import { useState } from 'react'
import {
  ModuleHeader,
  FilterEmptyState,
  OperationalEmptyState,
  OperationalListSkeleton,
  OperationalErrorState,
} from '@/shared/components'
import { Badge } from '@/shared/components/Badge'
import { usePrioritiesList } from '../hooks/usePriorities'
import {
  actionLevelLabel,
  attentionLevelLabel,
  domainLabel,
  verificationLevelLabel,
} from '../utils/priority-labels'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'
import { cn } from '@/shared/utils/cn'

function attentionVariant(level: string): 'default' | 'accent' | 'warning' | 'danger' {
  if (level === 'priority_attention') return 'danger'
  if (level === 'high_attention') return 'warning'
  if (level === 'review') return 'accent'
  return 'default'
}

export function PrioritiesPage() {
  const [attentionLevel, setAttentionLevel] = useState<string>('')
  const query = usePrioritiesList({
    attention_level: attentionLevel || undefined,
  })

  const items = query.data?.items ?? []
  const listEmpty = !query.isLoading && !query.isError && items.length === 0

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6" data-testid="priorities-page">
      <ModuleHeader
        title="Prioridades"
        description="Cola operacional de atención, verificación y acción derivada de hallazgos compuestos."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {['', 'review', 'high_attention', 'priority_attention'].map((level) => (
          <button
            key={level || 'all'}
            type="button"
            onClick={() => setAttentionLevel(level)}
            className={cn(
              'rounded-md border px-3 py-1.5 text-xs',
              attentionLevel === level
                ? 'border-accent bg-accent/10 text-text-primary'
                : 'border-border-subtle text-text-tertiary',
            )}
          >
            {level ? attentionLevelLabel(level) : 'Todas'}
          </button>
        ))}
      </div>

      {query.isLoading && <OperationalListSkeleton />}
      {query.isError && (
        <OperationalErrorState
          title="No se pudo cargar la cola de prioridades"
          explanation="Verifica tu conexión e intenta de nuevo."
          friendlyCode="PRI-LIST"
          onRetry={() => void query.refetch()}
        />
      )}

      <div className="space-y-3">
        {items.map((item, index) => (
          <Link
            key={item.id}
            to={`/prioridades/${item.id}`}
            className="block rounded-lg border border-border-subtle bg-surface-2/30 p-4 hover:border-accent/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                  Posición {index + 1}
                </p>
                <h3 className="text-sm font-semibold text-text-primary">
                  Evento térmico · {item.department_name ?? 'Sin departamento'}
                </h3>
                <p className="mt-1 text-xs text-text-tertiary">
                  Evaluado {formatGuatemalaDateTime(item.evaluated_at)}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant={attentionVariant(item.attention_level)}>
                  {attentionLevelLabel(item.attention_level)}
                </Badge>
                <Badge variant="default">{verificationLevelLabel(item.verification_level)}</Badge>
                <Badge variant="default">{actionLevelLabel(item.action_level)}</Badge>
              </div>
            </div>

            <div className="mt-3 grid gap-2 text-xs text-text-secondary sm:grid-cols-3">
              <div>
                <span className="text-text-tertiary">Atención</span>
                <p className="font-medium text-text-primary">{item.attention_score}</p>
              </div>
              <div>
                <span className="text-text-tertiary">Verificación</span>
                <p className="font-medium text-text-primary">{item.verification_score}</p>
              </div>
              <div>
                <span className="text-text-tertiary">Acción</span>
                <p className="font-medium text-text-primary">{item.action_score}</p>
              </div>
            </div>

            {item.priority_reasons.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-xs text-text-secondary">
                {item.priority_reasons.slice(0, 3).map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}

            <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-text-tertiary">
              {item.dominant_domains.map((d) => (
                <span key={d}>{domainLabel(d)}</span>
              ))}
            </div>
          </Link>
        ))}

        {listEmpty && attentionLevel && (
          <FilterEmptyState
            resourceLabel="prioridades"
            onClearFilters={() => setAttentionLevel('')}
          />
        )}
        {listEmpty && !attentionLevel && (
          <OperationalEmptyState
            title="No hay prioridades activas"
            explanation="Las evaluaciones aparecen cuando existen hallazgos o eventos que requieren atención operacional."
            sourceProcess="Hallazgos → evaluación de prioridad"
            status="pending"
          />
        )}
      </div>
    </div>
  )
}
