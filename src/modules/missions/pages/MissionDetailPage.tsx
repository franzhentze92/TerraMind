import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '@/shared/components/PageHeader'
import { Badge } from '@/shared/components/Badge'
import { useMissionDetail } from '../hooks/useMissions'
import {
  missionAssigneeTypeLabel,
  missionAssignmentStatusLabel,
  missionStatusLabel,
  missionTaskStatusLabel,
  missionTypeLabel,
} from '../utils/mission-labels'
import {
  MISSION_DEMO_READONLY_BANNER,
  MISSION_DEMO_RESPONSIBLE,
  missionDisplayLocation,
  missionDisplayObjective,
  missionDisplayTitle,
  missionPriorityLabel,
  missionShortRef,
  sanitizeMissionReason,
  shouldShowExpiry,
} from '../utils/mission-presentation'
import { evidenceTypeLabel } from '@/shared/product-language'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'
import { pluralizeCount } from '@/shared/format/plural'
import { MissionWorkflowActions } from '../components/MissionWorkflowActions'
import { MissionEvidenceSection } from '@/modules/evidence/components/MissionEvidenceSection'
import { MissionResolutionContributionsSection } from '@/modules/verification/components/MissionResolutionContributionsSection'
import { OfflinePackageSection } from '@/modules/field-operations/offline-packages/components/OfflinePackageSection'
import { IntelligenceFlowSections } from '@/modules/intelligence-flow/components/IntelligenceFlowSections'

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

  const classification = String(mission.classification ?? 'operational')
  const isDemo = classification === 'demo'
  const tasks = (mission.tasks as Array<Record<string, unknown>> | undefined) ?? []
  const evidence =
    (mission.evidence_requirements as Array<Record<string, unknown>> | undefined) ?? []
  const transitions = (mission.transitions as Array<Record<string, unknown>> | undefined) ?? []
  const assignmentHistory =
    (mission.assignment_history as Array<Record<string, unknown>> | undefined) ?? []

  const displayTitle = missionDisplayTitle(
    { title: mission.title as string, mission_type: mission.mission_type as string, id: String(mission.id) },
    classification,
  )
  const activeAssignment = mission.active_assignment as Record<string, unknown> | null

  const responsibleName = isDemo
    ? MISSION_DEMO_RESPONSIBLE
    : activeAssignment
      ? (activeAssignment.assignee_display_name
          ? String(activeAssignment.assignee_display_name)
          : activeAssignment.assignee_type
            ? missionAssigneeTypeLabel(String(activeAssignment.assignee_type))
            : 'Asignado')
      : 'Sin responsable asignado'

  const dueText = formatGuatemalaDateTime(String(mission.due_at))
  const expiresText = formatGuatemalaDateTime(String(mission.expires_at))
  const showExpires = shouldShowExpiry(mission.due_at as string, mission.expires_at as string)

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6" data-testid="mission-detail-page">
      <PageHeader
        title={displayTitle}
        subtitle={`${missionTypeLabel(String(mission.mission_type))} · Ref. ${missionShortRef(String(mission.id))}`}
        breadcrumbs={[
          { label: 'Situación Nacional', to: '/situacion' },
          { label: 'Misiones', to: '/misiones' },
          { label: displayTitle.slice(0, 48) },
        ]}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {isDemo && <Badge variant="warning">Demostración</Badge>}
        <Badge variant="default">{missionStatusLabel(String(mission.status))}</Badge>
        <Badge variant="default" title={missionPriorityLabel(mission.priority as number)}>
          P{String(mission.priority)}
        </Badge>
      </div>

      {isDemo && (
        <div
          data-testid="mission-demo-banner"
          className="mb-4 rounded-lg border border-confidence-medium/40 bg-confidence-medium/10 px-4 py-2 text-xs font-semibold tracking-wide text-confidence-medium"
        >
          {MISSION_DEMO_READONLY_BANNER}
        </div>
      )}

      {/* 1. Objetivo */}
      <section className="mb-6 rounded-lg border border-border-subtle bg-surface-2/30 p-4 text-sm">
        <p className="text-[10px] uppercase tracking-wider text-text-tertiary">Objetivo</p>
        <p className="mt-1 text-text-secondary">
          {missionDisplayObjective(mission.objective as string, classification)}
        </p>
      </section>

      {/* 2. Incidente relacionado + responsable + fechas */}
      <section className="mb-6 grid gap-3 rounded-lg border border-border-subtle bg-surface-2/30 p-4 text-sm md:grid-cols-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-tertiary">
            Incidente relacionado
          </p>
          <Link
            to={`/incidentes/${mission.incident_id}`}
            className="text-accent hover:underline"
          >
            {mission.incident_display_name
              ? String(mission.incident_display_name)
              : 'Ver incidente'}
          </Link>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-tertiary">Responsable</p>
          <p className="text-text-secondary">{responsibleName}</p>
          {activeAssignment && !isDemo && (
            <p className="text-text-tertiary">
              {missionAssignmentStatusLabel(String(activeAssignment.status))}
            </p>
          )}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-tertiary">Fecha límite</p>
          <p className="text-text-secondary">{dueText}</p>
          {showExpires && <p className="text-text-tertiary">Expira: {expiresText}</p>}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-tertiary">Ubicación</p>
          <p className="text-text-secondary">
            {missionDisplayLocation(mission.location_description as string, classification)}
          </p>
        </div>
        {activeAssignment && !isDemo && Boolean(activeAssignment.assignee_id) && (
          <details className="text-text-tertiary md:col-span-2">
            <summary className="cursor-pointer select-none text-xs">Detalle técnico</summary>
            <p className="mt-1 text-xs">Identificador: {String(activeAssignment.assignee_id)}</p>
          </details>
        )}
      </section>

      {/* 3. Tareas */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-text-primary">Tareas</h2>
        <div className="mt-3 space-y-2">
          {tasks.map((t) => (
            <div key={String(t.id)} className="rounded border border-border-subtle px-3 py-2 text-xs">
              <div className="flex justify-between gap-2">
                <p className="font-medium text-text-primary">
                  {String(t.sequence)}. {String(t.title)}
                </p>
                <span className="text-text-tertiary">{missionTaskStatusLabel(String(t.status))}</span>
              </div>
              <p className="mt-1 text-text-secondary">{String(t.instructions)}</p>
            </div>
          ))}
          {tasks.length === 0 && <p className="text-xs text-text-tertiary">Sin tareas registradas.</p>}
        </div>
      </section>

      {/* 4. Evidencia requerida */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-text-primary">Evidencia requerida</h2>
        <div className="mt-3 space-y-2">
          {evidence.map((e) => (
            <div key={String(e.id)} className="rounded border border-border-subtle px-3 py-2 text-xs">
              <p className="font-medium text-text-primary">{evidenceTypeLabel(String(e.evidence_type))}</p>
              <p className="text-text-tertiary">
                Mínimo{' '}
                {pluralizeCount(Number(e.minimum_count), 'elemento', 'elementos')} ·{' '}
                {e.required ? 'obligatorio' : 'opcional'}
              </p>
            </div>
          ))}
          {evidence.length === 0 && (
            <p className="text-xs text-text-tertiary">Sin requisitos de evidencia.</p>
          )}
        </div>
      </section>

      {/* 5. Evidencia recibida + progreso */}
      <section id="evidencia" className="scroll-mt-6">
        <MissionEvidenceSection missionId={String(mission.id)} classification={classification} />
      </section>
      <MissionResolutionContributionsSection missionId={String(mission.id)} />

      {/* 6. Paquete offline */}
      <OfflinePackageSection
        missionId={String(mission.id)}
        missionTitle={displayTitle}
        missionStatus={String(mission.status)}
        classification={classification}
      />

      {/* 7. Acciones administrativas */}
      <MissionWorkflowActions
        missionId={String(mission.id)}
        status={String(mission.status)}
        classification={classification}
        assignmentStatus={activeAssignment ? String(activeAssignment.status) : null}
      />

      {/* 8. Historial */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-text-primary">
          {isDemo ? 'Historial de demostración' : 'Historial de responsables'}
        </h2>
        <div className="mt-3 space-y-2">
          {assignmentHistory.map((h) => {
            const reason = sanitizeMissionReason(h.reason as string, classification)
            return (
              <div key={String(h.id)} className="rounded border border-border-subtle px-3 py-2 text-xs">
                <p className="font-medium text-text-primary">
                  {missionAssignmentStatusLabel(String(h.to_status))}
                  {h.from_status
                    ? ` (desde ${missionAssignmentStatusLabel(String(h.from_status))})`
                    : ''}
                </p>
                {reason && <p className="text-text-secondary">{reason}</p>}
                {Boolean(h.created_at) && (
                  <p className="text-text-tertiary">
                    {formatGuatemalaDateTime(String(h.created_at))}
                  </p>
                )}
              </div>
            )
          })}
          {assignmentHistory.length === 0 && (
            <p className="text-xs text-text-tertiary">Sin historial de asignación.</p>
          )}
        </div>
      </section>

      {/* 9. Timeline */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-text-primary">Línea de tiempo</h2>
        <div className="mt-3 space-y-2">
          {transitions.map((tr) => {
            const reason = sanitizeMissionReason(tr.reason as string, classification)
            return (
              <div key={String(tr.id)} className="rounded border border-border-subtle px-3 py-2 text-xs">
                <p className="font-medium text-text-primary">
                  {missionStatusLabel(String(tr.from_status))} → {missionStatusLabel(String(tr.to_status))}
                </p>
                {reason && <p className="text-text-secondary">{reason}</p>}
                <p className="text-text-tertiary">
                  {formatGuatemalaDateTime(String(tr.transitioned_at))}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      <IntelligenceFlowSections resourceType="mission" resourceId={missionId} />
    </div>
  )
}
