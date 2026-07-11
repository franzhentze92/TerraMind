import { Link, useSearchParams } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import { PageHeader, OperationalEmptyState } from '@/shared/components'
import { Badge } from '@/shared/components/Badge'
import { useHasPermission } from '@/core/auth/AuthProvider'
import { useMissionsList } from '../hooks/useMissions'
import { missionStatusLabel, missionTypeLabel } from '../utils/mission-labels'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'
import { cn } from '@/shared/utils/cn'
import { MissionsAssignmentsPanel } from '../components/MissionsAssignmentsPanel'

const TABS = [
  { key: 'all', label: 'Todas', status: '' },
  { key: 'unassigned', label: 'Sin asignar', status: 'ready' },
  { key: 'assigned', label: 'Asignadas', status: 'assigned' },
  { key: 'in_progress', label: 'En curso', status: 'in_progress' },
  { key: 'blocked', label: 'Bloqueadas', status: 'blocked' },
  { key: 'completed', label: 'Completadas', status: 'completed' },
  { key: 'assignments', label: 'Gestionar asignaciones', status: '__assignments__' },
] as const

export function MissionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') ?? 'all'
  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0]
  const canAssign = useHasPermission('missions.assign')
  const query = useMissionsList({
    status: activeTab.status && activeTab.status !== '__assignments__' ? activeTab.status : undefined,
  })

  const visibleTabs = TABS.filter((t) => t.key !== 'assignments' || canAssign)

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <PageHeader
        title="Misiones"
        subtitle="Unidades de trabajo derivadas de planes de verificación elegibles."
        breadcrumbs={[
          { label: 'Operaciones', to: '/verificaciones' },
          { label: 'Misiones' },
        ]}
        actions={
          canAssign ? (
            <Link
              to="/misiones?tab=assignments"
              className="rounded-lg border border-border-subtle px-3 py-1.5 text-xs text-text-secondary hover:border-accent/40"
            >
              Gestionar asignaciones
            </Link>
          ) : undefined
        }
      />

      <div className="mb-4 mt-4 flex flex-wrap gap-2">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSearchParams(t.key === 'all' ? {} : { tab: t.key })}
            className={cn(
              'rounded-md border px-3 py-1.5 text-xs',
              tab === t.key
                ? 'border-accent bg-accent/10 text-text-primary'
                : 'border-border-subtle text-text-tertiary',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'assignments' && canAssign ? (
        <MissionsAssignmentsPanel />
      ) : (
        <>
          {query.isLoading && <p className="text-sm text-text-tertiary">Cargando misiones…</p>}
          {query.isError && (
            <p className="text-sm text-confidence-low">No se pudo cargar la lista de misiones.</p>
          )}

          <div className="space-y-3">
            {(query.data?.items ?? []).map((item) => (
              <Link
                key={item.id}
                to={`/misiones/${item.id}`}
                className="block rounded-lg border border-border-subtle bg-surface-2/30 p-4 hover:border-accent/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                      {missionTypeLabel(item.mission_type)}
                    </p>
                    <h3 className="text-sm font-semibold text-text-primary">{item.title}</h3>
                    <p className="mt-1 text-xs text-text-tertiary">
                      Incidente relacionado · {item.task_count} tarea(s) ·{' '}
                      {item.required_evidence_count} evidencia(s) requerida(s)
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="default">{missionStatusLabel(item.status)}</Badge>
                    <Badge variant="default">P{item.priority}</Badge>
                  </div>
                </div>
                <p className="mt-2 text-xs text-text-secondary">
                  Límite {formatGuatemalaDateTime(item.due_at)} · expira{' '}
                  {formatGuatemalaDateTime(item.expires_at)}
                </p>
              </Link>
            ))}
            {(query.data?.items ?? []).length === 0 && !query.isLoading && (
              <OperationalEmptyState
                icon={<ClipboardList className="h-5 w-5" />}
                title="No hay misiones operacionales"
                explanation="Se crean desde planes de verificación que requieren trabajo de campo."
                sourceProcess="Verificación → misión"
                primaryCta={{ label: 'Ver verificaciones', to: '/verificaciones' }}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}
