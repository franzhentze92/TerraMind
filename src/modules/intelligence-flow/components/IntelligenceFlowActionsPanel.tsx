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
      aria-label="Acciones relacionadas"
    >
      <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
        Acciones relacionadas
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {actions
          .filter((action) => action.route)
          .map((action) => (
            <Link
              key={action.id}
              to={action.route as string}
              className="inline-flex rounded-md border border-border-subtle bg-surface-1/40 px-3 py-1.5 text-xs text-accent hover:border-accent/40"
            >
              {action.label} →
            </Link>
          ))}
      </div>
      {actions.some((action) => !action.route && action.explanation) && (
        <ul className="mt-2 space-y-1">
          {actions
            .filter((action) => !action.route && action.explanation)
            .map((action) => (
              <li key={action.id} className="text-xs text-text-secondary">
                <span className="font-medium text-text-primary">{action.label}: </span>
                {action.explanation}
              </li>
            ))}
        </ul>
      )}
    </section>
  )
}
