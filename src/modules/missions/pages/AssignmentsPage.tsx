import { Link } from 'react-router-dom'
import { ModuleHeader } from '@/shared/components'
import { Badge } from '@/shared/components/Badge'
import { useMissionsList } from '../hooks/useMissions'
import { missionStatusLabel } from '../utils/mission-labels'

export function AssignmentsPage() {
  const unassigned = useMissionsList({ status: 'ready' })
  const assigned = useMissionsList({ status: 'assigned' })
  const active = useMissionsList({ status: 'in_progress' })
  const blocked = useMissionsList({ status: 'blocked' })

  const sections = [
    { title: 'Sin asignar', query: unassigned },
    { title: 'Asignadas sin iniciar', query: assigned },
    { title: 'Activas', query: active },
    { title: 'Bloqueadas', query: blocked },
  ]

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <ModuleHeader
        title="Asignaciones operacionales"
        description="Misiones por estado de asignación y carga operativa."
      />

      <div className="space-y-6">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="mb-2 text-sm font-semibold text-text-primary">{section.title}</h2>
            {section.query.isLoading && (
              <p className="text-xs text-text-tertiary">Cargando…</p>
            )}
            <div className="space-y-2">
              {(section.query.data?.items ?? []).map((item) => (
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
              {(section.query.data?.items ?? []).length === 0 && !section.query.isLoading && (
                <p className="text-xs text-text-tertiary">Sin registros.</p>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
