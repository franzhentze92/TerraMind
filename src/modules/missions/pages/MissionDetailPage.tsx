import { Link, useParams } from 'react-router-dom'
import { ModuleHeader } from '@/shared/components'
import { Badge } from '@/shared/components/Badge'
import { useMissionDetail } from '../hooks/useMissions'
import { missionStatusLabel, missionTypeLabel } from '../utils/mission-labels'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'
import { MissionWorkflowActions } from '../components/MissionWorkflowActions'
import { MissionEvidenceSection } from '@/modules/evidence/components/MissionEvidenceSection'

export function MissionDetailPage() {
  const { missionId } = useParams()
  const query = useMissionDetail(missionId)
  const mission = query.data

  if (query.isLoading) {
    return <p className="p-6 text-sm text-text-tertiary">Cargando misión…</p>
  }
  if (!mission) {
    return <p className="p-6 text-sm text-confidence-low">Misión no encontrada.</p>
  }

  const tasks = (mission.tasks as Array<Record<string, unknown>> | undefined) ?? []
  const evidence =
    (mission.evidence_requirements as Array<Record<string, unknown>> | undefined) ?? []
  const transitions = (mission.transitions as Array<Record<string, unknown>> | undefined) ?? []

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <ModuleHeader
        title={String(mission.title)}
        description={missionTypeLabel(String(mission.mission_type))}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge variant="default">{missionStatusLabel(String(mission.status))}</Badge>
        <Badge variant="default">Prioridad {String(mission.priority)}</Badge>
      </div>

      <section className="mb-6 rounded-lg border border-border-subtle bg-surface-2/30 p-4 text-sm">
        <p className="text-[10px] uppercase tracking-wider text-text-tertiary">Objetivo</p>
        <p className="mt-1 text-text-secondary">{String(mission.objective)}</p>

        {mission.active_assignment ? (
          <div className="mt-4 rounded border border-border-subtle/60 bg-surface-1/40 p-3 text-xs">
            <p className="font-medium text-text-primary">Asignación operacional</p>
            <p className="mt-1 text-text-secondary">
              Responsable: {String((mission.active_assignment as Record<string, unknown>).assignee_id)}
            </p>
            <p className="text-text-tertiary">
              Estado: {String((mission.active_assignment as Record<string, unknown>).status)}
            </p>
            {(mission.active_assignment as Record<string, unknown>).block_reason && (
              <p className="mt-1 text-confidence-low">
                Bloqueo: {String((mission.active_assignment as Record<string, unknown>).block_reason)}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-3 text-xs text-text-tertiary">Sin responsable asignado.</p>
        )}
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <p className="text-xs text-text-tertiary">
            Incidente:{' '}
            <Link to={`/incidentes/${mission.incident_id}`} className="text-accent hover:underline">
              Ver incidente
            </Link>
          </p>
          <p className="text-xs text-text-tertiary">
            Plan: {String(mission.verification_plan_id).slice(0, 8)}…
          </p>
          <p className="text-xs text-text-tertiary">
            Inicio más temprano: {formatGuatemalaDateTime(String(mission.earliest_start_at))}
          </p>
          <p className="text-xs text-text-tertiary">
            Límite: {formatGuatemalaDateTime(String(mission.due_at))}
          </p>
          <p className="text-xs text-text-tertiary">
            Expira: {formatGuatemalaDateTime(String(mission.expires_at))}
          </p>
          <p className="text-xs text-text-tertiary">
            Ubicación: {String(mission.location_description)}
          </p>
        </div>
      </section>

      <MissionWorkflowActions
        missionId={String(mission.id)}
        status={String(mission.status)}
        assignmentStatus={
          mission.active_assignment
            ? String((mission.active_assignment as Record<string, unknown>).status)
            : null
        }
      />

      <MissionEvidenceSection missionId={String(mission.id)} />

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-text-primary">Tareas</h2>
        <div className="mt-3 space-y-2">
          {tasks.map((t) => (
            <div key={String(t.id)} className="rounded border border-border-subtle px-3 py-2 text-xs">
              <div className="flex justify-between gap-2">
                <p className="font-medium text-text-primary">
                  {String(t.sequence)}. {String(t.title)}
                </p>
                <span className="text-text-tertiary">{String(t.status)}</span>
              </div>
              <p className="mt-1 text-text-secondary">{String(t.instructions)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-text-primary">Evidencia requerida</h2>
        <div className="mt-3 space-y-2">
          {evidence.map((e) => (
            <div key={String(e.id)} className="rounded border border-border-subtle px-3 py-2 text-xs">
              <p className="font-medium text-text-primary">{String(e.evidence_type)}</p>
              <p className="text-text-tertiary">
                Mínimo {String(e.minimum_count)} · {e.required ? 'obligatorio' : 'opcional'}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-text-primary">Historial de responsables</h2>
        <div className="mt-3 space-y-2">
          {((mission.assignment_history as Array<Record<string, unknown>> | undefined) ?? []).map(
            (h) => (
              <div
                key={String(h.id)}
                className="rounded border border-border-subtle px-3 py-2 text-xs"
              >
                <p className="font-medium text-text-primary">
                  {String(h.action)} · {String(h.from_status)} → {String(h.to_status)}
                </p>
                <p className="text-text-secondary">{String(h.reason)}</p>
              </div>
            ),
          )}
          {((mission.assignment_history as Array<Record<string, unknown>> | undefined) ?? [])
            .length === 0 && (
            <p className="text-xs text-text-tertiary">Sin historial de asignación.</p>
          )}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-text-primary">Timeline de misión</h2>
        <div className="mt-3 space-y-2">
          {transitions.map((tr) => (
            <div key={String(tr.id)} className="rounded border border-border-subtle px-3 py-2 text-xs">
              <p className="font-medium text-text-primary">
                {String(tr.from_status)} → {String(tr.to_status)}
              </p>
              <p className="text-text-secondary">{String(tr.reason)}</p>
              <p className="text-text-tertiary">
                {formatGuatemalaDateTime(String(tr.transitioned_at))}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
