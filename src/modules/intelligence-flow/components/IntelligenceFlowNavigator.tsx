import { Link } from 'react-router-dom'
import { cn } from '@/shared/utils/cn'
import { FLOW_STAGE_ORDER, FLOW_STAGE_LABELS, FLOW_STATUS_HINTS } from '../intelligence-flow.constants'
import type { IntelligenceFlowDto, IntelligenceFlowNode } from '../intelligence-flow.types'

const STATUS_SYMBOL: Record<string, string> = {
  available: '✓',
  pending: '…',
  not_required: '—',
  blocked: '⊘',
  missing: '—',
  legacy: 'L',
  demo: 'D',
}

const STATUS_CLASS: Record<string, string> = {
  available: 'text-emerald-300 border-emerald-500/40',
  pending: 'text-amber-300 border-amber-500/40',
  not_required: 'text-text-tertiary border-border-subtle',
  blocked: 'text-red-300 border-red-500/40',
  missing: 'text-text-tertiary border-border-subtle',
  legacy: 'text-amber-300 border-amber-500/40',
  demo: 'text-violet-300 border-violet-500/40',
}

interface IntelligenceFlowNavigatorProps {
  flow: IntelligenceFlowDto | undefined
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  className?: string
}

export function IntelligenceFlowNavigator({
  flow,
  isLoading,
  isError,
  onRetry,
  className,
}: IntelligenceFlowNavigatorProps) {
  if (isLoading) {
    return (
      <div className={cn('rounded-xl border border-border-subtle bg-surface-2/30 p-4', className)} data-testid="intelligence-flow-navigator-loading">
        <div className="h-4 w-48 animate-pulse rounded bg-surface-3" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className={cn('rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200', className)} data-testid="intelligence-flow-navigator-error">
        No se pudo cargar el flujo operacional.{' '}
        {onRetry && (
          <button type="button" onClick={onRetry} className="underline">
            Reintentar
          </button>
        )}
      </div>
    )
  }

  if (!flow) return null

  const nodeByStage = new Map(flow.nodes.map((n) => [n.stage, n]))

  return (
    <nav
      className={cn('rounded-xl border border-border-subtle bg-surface-2/30 p-4', className)}
      aria-label="Ciclo de inteligencia"
      data-testid="intelligence-flow-navigator"
    >
      <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
        Ciclo operacional
      </p>
      {flow.classification !== 'operational' && (
        <p className="mt-1 text-[11px] text-amber-300">
          {flow.classification === 'legacy'
            ? 'Registro legacy — ownership pendiente.'
            : 'Demostración interna — no operacional.'}
        </p>
      )}
      <ol className="mt-3 flex flex-wrap gap-2">
        {FLOW_STAGE_ORDER.map((stage) => {
          const n = nodeByStage.get(stage)
          if (!n) return null
          return (
            <FlowStep key={stage} node={n} isCurrent={flow.current_stage === stage} />
          )
        })}
      </ol>
    </nav>
  )
}

function FlowStep({ node, isCurrent }: { node: IntelligenceFlowNode; isCurrent: boolean }) {
  const symbol = STATUS_SYMBOL[node.status] ?? '—'
  const content = (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs',
        STATUS_CLASS[node.status] ?? STATUS_CLASS.missing,
        isCurrent && 'ring-1 ring-accent/50',
      )}
      title={node.blockingReason ?? node.summary ?? FLOW_STATUS_HINTS[node.status]}
    >
      <span className="font-mono text-[10px]">{symbol}</span>
      <span>{FLOW_STAGE_LABELS[node.stage]}</span>
    </span>
  )

  if (node.status === 'available' && node.route) {
    return (
      <li>
        <Link to={node.route} className="hover:opacity-90">
          {content}
        </Link>
      </li>
    )
  }

  return <li>{content}</li>
}
