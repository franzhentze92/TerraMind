import { Link } from 'react-router-dom'
import { useAuth } from '@/core/auth/AuthProvider'
import type { TerramindPermission } from '@/core/auth/permissions'
import { buildIntelligenceFlowActions } from '../intelligence-flow-actions'
import type { IntelligenceFlowDto } from '../intelligence-flow.types'

interface IntelligenceFlowActionsProps {
  flow: IntelligenceFlowDto | undefined
  className?: string
}

export function IntelligenceFlowActionsPanel({ flow, className }: IntelligenceFlowActionsProps) {
  const { authContext } = useAuth()
  const permissions = new Set(authContext?.permissions ?? [])
  if (authContext?.isPlatformAdmin) {
    permissions.add('findings.view' as TerramindPermission)
    permissions.add('priorities.view' as TerramindPermission)
    permissions.add('incidents.view' as TerramindPermission)
    permissions.add('verification_plans.view' as TerramindPermission)
    permissions.add('missions.view' as TerramindPermission)
    permissions.add('responses.view' as TerramindPermission)
    permissions.add('evidence.view' as TerramindPermission)
  }

  const actions = buildIntelligenceFlowActions(
    flow,
    permissions,
    authContext?.isPlatformAdmin,
  ).filter((a) => a.route || a.explanation)

  if (actions.length === 0) return null

  return (
    <section
      className={className}
      data-testid="intelligence-flow-actions"
    >
      <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
        Continuar en el ciclo
      </p>
      <ul className="mt-2 space-y-2">
        {actions.map((action) => (
          <li key={action.id}>
            {action.route ? (
              <Link
                to={action.route}
                className="inline-flex rounded-md border border-border-subtle bg-surface-1/40 px-3 py-1.5 text-xs text-accent hover:border-accent/40"
              >
                {action.label} →
              </Link>
            ) : (
              <div className="text-xs text-text-secondary">
                <span className="font-medium text-text-primary">{action.label}: </span>
                {action.explanation}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
