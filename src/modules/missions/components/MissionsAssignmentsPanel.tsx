import { ClipboardList } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/shared/components/Badge'
import { OperationalEmptyState, OperationalListSkeleton } from '@/shared/components'
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
        title="No hay asignaciones pendientes"
        explanation="Las asignaciones se crean desde misiones listas para ejecución."
        sourceProcess="Misión lista → asignación de responsable"
        requiredPermission="missions.assign"
        primaryAction={{ label: 'Ver misiones sin asignar', href: '/misiones?tab=unassigned' }}
        secondaryAction={{ label: 'Ver todas las misiones', href: '/misiones' }}
      />
    )
  }

  const anyLoading = queries.some((q) => q.isLoading)
  if (anyLoading) return <OperationalListSkeleton rows={3} />

  return (
    <div className="space-y-6">
      {SECTIONS.map((section, i) => {
        const query = queries[i]
        return (
          <section key={section.title}>
            <h2 className="mb-2 text-sm font-semibold text-text-primary">{section.title}</h2>
            {query.isLoading && <p className="text-xs text-text-tertiary">Cargando…</p>}
            {!query.isLoading && (query.data?.items ?? []).length === 0 && (
              <p className="text-xs text-text-tertiary">Ninguna en esta sección.</p>
            )}
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
