import { Link } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import { Badge } from '@/shared/components/Badge'
import { OperationalEmptyState } from '@/shared/components'
import { useMissionsList } from '../hooks/useMissions'
import { missionStatusLabel } from '../utils/mission-labels'

const SECTIONS = [
  { title: 'Sin asignar', status: 'ready' as const },
  { title: 'Asignadas sin iniciar', status: 'assigned' as const },
  { title: 'En curso', status: 'in_progress' as const },
  { title: 'Bloqueadas', status: 'blocked' as const },
]

export function MissionsAssignmentsPanel() {
  const unassigned = useMissionsList({ status: 'ready' })
  const assigned = useMissionsList({ status: 'assigned' })
  const active = useMissionsList({ status: 'in_progress' })
  const blocked = useMissionsList({ status: 'blocked' })
  const queries = [unassigned, assigned, active, blocked]
  const allEmpty =
    !queries.some((q) => q.isLoading) &&
    queries.every((q) => (q.data?.items ?? []).length === 0)

  if (allEmpty) {
    return (
      <OperationalEmptyState
        icon={<ClipboardList className="h-5 w-5" />}
        title="No hay misiones listas para asignar"
        explanation="Las asignaciones aparecerán cuando una misión alcance el estado listo."
        sourceProcess="Planes de verificación → misión lista"
        requiredPermission="missions.assign"
        primaryCta={{ label: 'Ver misiones', to: '/misiones' }}
        secondaryCta={{ label: 'Ver verificaciones', to: '/verificaciones' }}
      />
    )
  }

  return (
    <div className="space-y-6">
      {SECTIONS.map((section, i) => {
        const query = queries[i]
        return (
          <section key={section.title}>
            <h2 className="mb-2 text-sm font-semibold text-text-primary">{section.title}</h2>
            {query.isLoading && <p className="text-xs text-text-tertiary">Cargando…</p>}
            <div className="space-y-2">
              {(query.data?.items ?? []).map((item) => (
                <Link
                  key={item.id}
                  to={`/misiones/${item.id}`}
                  className="block rounded border border-border-subtle bg-surface-2/30 px-3 py-2 text-xs hover:border-accent/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-text-primary">{item.title}</span>
                    <Badge variant="default">{missionStatusLabel(item.status)}</Badge>
                  </div>
                  <p className="mt-1 text-text-tertiary">
                    P{item.priority} · vence {new Date(item.due_at).toLocaleString('es-GT')}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
