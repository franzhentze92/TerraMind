import { useState } from 'react'
import { useMissionWorkflow } from '../hooks/useMissionWorkflow'
import type { MissionWorkflowAction } from '../api/missions-api'
import { missionWorkflowActionLabel } from '../utils/mission-labels'
import { MISSION_DEMO_ACTIONS_DISABLED } from '../utils/mission-presentation'

interface MissionWorkflowActionsProps {
  missionId: string
  status: string
  assignmentStatus?: string | null
  classification?: string
}

const ACTIONS_BY_STATUS: Record<string, MissionWorkflowAction[]> = {
  ready: ['assign', 'cancel'],
  approved: ['assign', 'reassign', 'cancel'],
  assigned: ['accept', 'decline', 'start', 'reassign', 'cancel'],
  in_progress: ['block', 'complete', 'cancel'],
  blocked: ['resume', 'complete', 'cancel'],
}

export function MissionWorkflowActions({
  missionId,
  status,
  assignmentStatus,
  classification,
}: MissionWorkflowActionsProps) {
  const workflow = useMissionWorkflow(missionId)
  const [assigneeId, setAssigneeId] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Demo missions must never trigger real operational mutations.
  if (classification === 'demo') {
    return (
      <section className="mb-6 rounded-lg border border-border-subtle bg-surface-2/30 p-4">
        <h2 className="text-sm font-semibold text-text-primary">Acciones</h2>
        <p className="mt-1 text-xs text-text-secondary" data-testid="mission-demo-actions-disabled">
          {MISSION_DEMO_ACTIONS_DISABLED}
        </p>
      </section>
    )
  }

  let actions = ACTIONS_BY_STATUS[status] ?? []
  if (status === 'assigned' && assignmentStatus === 'assigned') {
    actions = actions.filter((a) => a !== 'start')
  }
  return renderPanel(actions)

  function renderPanel(available: MissionWorkflowAction[]) {
    if (available.length === 0) return null

    async function run(action: MissionWorkflowAction) {
      setError(null)
      try {
        await workflow.mutateAsync({
          action,
          payload: {
            assignee_type: ['assign', 'reassign'].includes(action) ? 'user' : undefined,
            assignee_id: ['assign', 'reassign'].includes(action) ? assigneeId : undefined,
            reason: ['decline', 'block', 'reassign', 'cancel', 'complete'].includes(action)
              ? reason
              : undefined,
            explicit_inconclusive: action === 'complete' && reason.length > 0,
          },
        })
        setReason('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error de workflow')
      }
    }

    const needsAssignee = available.some((a) => ['assign', 'reassign'].includes(a))
    const needsReason = available.some((a) =>
      ['decline', 'block', 'reassign', 'cancel', 'complete'].includes(a),
    )

    return (
      <section className="mb-6 rounded-lg border border-border-subtle bg-surface-2/30 p-4">
        <h2 className="text-sm font-semibold text-text-primary">Acciones administrativas</h2>
        <p className="mt-1 text-xs text-text-tertiary">
          Cambian el estado operativo de la misión y quedan registradas.
        </p>

        {needsReason && (
          <label className="mt-3 block text-xs text-text-secondary">
            Motivo (si aplica)
            <input
              className="mt-1 w-full rounded border border-border-subtle bg-surface-1 px-2 py-1 text-xs"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {available.map((action) => (
            <button
              key={action}
              type="button"
              disabled={workflow.isPending || (['assign', 'reassign'].includes(action) && !assigneeId.trim())}
              onClick={() => run(action)}
              className="rounded border border-accent/40 px-2 py-1 text-xs text-accent hover:bg-accent/10 disabled:opacity-50"
            >
              {missionWorkflowActionLabel(action)}
            </button>
          ))}
        </div>

        {needsAssignee && (
          <details className="mt-3 text-xs text-text-tertiary">
            <summary className="cursor-pointer select-none">
              Asignar responsable (uso técnico)
            </summary>
            <p className="mt-1">
              Aún no existe un selector de usuarios/equipos. Para asignar o reasignar, introduce el
              identificador del responsable en el sistema operacional.
            </p>
            <input
              className="mt-1 w-full rounded border border-border-subtle bg-surface-1 px-2 py-1 text-xs"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              placeholder="Identificador de responsable"
            />
          </details>
        )}

        {error && <p className="mt-2 text-xs text-confidence-low">{error}</p>}
        {workflow.isSuccess && (
          <p className="mt-2 text-xs text-confidence-high">Acción registrada.</p>
        )}
      </section>
    )
  }
}
