import { Link, useParams } from 'react-router-dom'
import { ModuleHeader } from '@/shared/components'
import { Badge } from '@/shared/components/Badge'
import { useIncidentDetail, useIncidentHistory } from '../hooks/useIncidents'
import {
  evidenceStatusLabel,
  incidentStatusLabel,
  incidentStatusVariant,
  incidentTypeLabel,
} from '../utils/incident-labels'
import {
  actionLevelLabel,
  attentionLevelLabel,
  verificationLevelLabel,
} from '@/modules/priorities/utils/priority-labels'
import { lifecycleStateLabel } from '@/modules/lifecycle/utils/lifecycle-labels'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'
import { VerificationPlanSection } from '@/modules/verification/components/VerificationPlanSection'
import { IncidentVerificationResolutionSection } from '@/modules/verification/components/IncidentVerificationResolutionSection'
import { IncidentMissionsSection } from '@/modules/missions/components/IncidentMissionsSection'
import { useResponseDetail } from '@/modules/response-orchestration/hooks/useResponseOrchestration'
import { ResponseStatusBadge } from '@/modules/response-orchestration/components/ResponseStatusBadge'
import { useHasPermission } from '@/core/auth/AuthProvider'

export function IncidentDetailPage() {
  const { incidentId } = useParams()
  const detailQuery = useIncidentDetail(incidentId)
  const historyQuery = useIncidentHistory(incidentId)
  const canViewResponse = useHasPermission('responses.view')
  const responseQuery = useResponseDetail(canViewResponse ? incidentId : undefined)
  const detail = detailQuery.data

  if (detailQuery.isLoading) {
    return <p className="p-6 text-sm text-text-tertiary">Cargando incidente…</p>
  }
  if (!detail) {
    return <p className="p-6 text-sm text-confidence-low">Incidente no encontrado.</p>
  }

  const members = (detail.members as Array<Record<string, unknown>> | undefined) ?? []
  const history = historyQuery.data?.items ?? []
  const limitations = (detail.priority_limitations as string[] | undefined) ?? []

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <ModuleHeader
        title="Detalle del incidente"
        description={incidentTypeLabel(String(detail.incident_type))}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge variant={incidentStatusVariant(String(detail.status))}>
          {incidentStatusLabel(String(detail.status))}
        </Badge>
        <Badge variant="default">{evidenceStatusLabel(String(detail.evidence_status))}</Badge>
        {canViewResponse && responseQuery.data?.badge && (
          <Link to={`/respuesta/${incidentId}`}>
            <ResponseStatusBadge badge={String(responseQuery.data.badge)} />
          </Link>
        )}
      </div>

      <section className="mb-6 grid gap-3 rounded-lg border border-border-subtle bg-surface-2/30 p-4 text-sm md:grid-cols-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-tertiary">Primera observación</p>
          <p className="text-text-secondary">
            {formatGuatemalaDateTime(String(detail.first_observed_at))}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-tertiary">Última observación</p>
          <p className="text-text-secondary">
            {formatGuatemalaDateTime(String(detail.last_observed_at))}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-tertiary">Prioridad agregada</p>
          <p className="text-text-secondary">
            Atención {attentionLevelLabel(String(detail.attention_level))} · Verificación{' '}
            {verificationLevelLabel(String(detail.verification_level))} · Acción{' '}
            {actionLevelLabel(String(detail.action_level))}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-tertiary">Evento principal</p>
          {detail.primary_event_id ? (
            <Link
              to={`/incendios/${detail.primary_event_id}`}
              className="text-accent hover:underline"
            >
              Ver evento térmico principal
            </Link>
          ) : (
            <p className="text-text-secondary">—</p>
          )}
        </div>
      </section>

      {limitations.length > 0 && (
        <section className="mb-6 rounded-lg border border-border-subtle px-4 py-3 text-xs text-text-secondary">
          <p className="font-medium text-text-primary">Limitaciones</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>
      )}

      {incidentId && (
        <section className="mb-6">
          <VerificationPlanSection incidentId={incidentId} />
        </section>
      )}

      {incidentId && (
        <section className="mb-6">
          <IncidentVerificationResolutionSection incidentId={incidentId} />
        </section>
      )}

      {incidentId && (
        <section className="mb-6">
          <IncidentMissionsSection incidentId={incidentId} />
        </section>
      )}

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-text-primary">Eventos miembros</h2>
        <div className="mt-3 space-y-2">
          {members.map((m) => (
            <div
              key={String(m.membership_id)}
              className="rounded border border-border-subtle px-3 py-2 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link to={`/incendios/${m.event_id}`} className="font-medium text-accent">
                  Evento {String(m.event_id).slice(0, 8)}…
                </Link>
                <span className="text-text-tertiary">{String(m.membership_role)}</span>
              </div>
              <p className="mt-1 text-text-secondary">
                {m.department_name ? String(m.department_name) : 'Sin departamento'} ·{' '}
                {m.lifecycle_state ? lifecycleStateLabel(String(m.lifecycle_state)) : '—'}
              </p>
              {Array.isArray(m.correlation_reasons) && m.correlation_reasons.length > 0 && (
                <p className="mt-1 text-text-tertiary">{String(m.correlation_reasons[0])}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-text-primary">Historial de membresía</h2>
        <div className="mt-3 space-y-2">
          {history.slice(0, 10).map((h) => (
            <div
              key={String((h as Record<string, unknown>).id)}
              className="rounded border border-border-subtle px-3 py-2 text-xs"
            >
              <p className="font-medium text-text-primary">{String((h as Record<string, unknown>).action)}</p>
              <p className="text-text-tertiary">
                {formatGuatemalaDateTime(String((h as Record<string, unknown>).created_at))}
              </p>
            </div>
          ))}
          {history.length === 0 && (
            <p className="text-xs text-text-tertiary">Sin historial registrado.</p>
          )}
        </div>
      </section>
    </div>
  )
}
