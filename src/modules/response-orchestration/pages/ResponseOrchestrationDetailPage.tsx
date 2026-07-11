import { Link, useParams } from 'react-router-dom'
import { useState } from 'react'
import { PageHeader } from '@/shared/components/PageHeader'
import { OperationalEmptyState } from '@/shared/components/OperationalEmptyState'
import { Badge } from '@/shared/components/Badge'
import { useHasPermission } from '@/core/auth/AuthProvider'
import {
  useResponseBriefing,
  useResponseDecisionActions,
  useResponseDetail,
  useResponseHistory,
} from '../hooks/useResponseOrchestration'
import { ResponseStatusBadge } from '../components/ResponseStatusBadge'
import { decisionStatusLabel, responseLevelLabel } from '../utils/response-status-labels'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'
import { useIncidentDetail } from '@/modules/incidents/hooks/useIncidents'
import {
  buildIncidentBreadcrumbLabel,
  buildIncidentDisplayName,
} from '@/modules/incidents/utils/incident-display-name'
import { IntelligenceFlowSections } from '@/modules/intelligence-flow/components/IntelligenceFlowSections'

function Section({ title, children, variant = 'default' }: { title: string; children: React.ReactNode; variant?: 'default' | 'recommended' | 'decision' }) {
  const border =
    variant === 'recommended'
      ? 'border-amber-500/30 bg-amber-500/5'
      : variant === 'decision'
        ? 'border-emerald-500/30 bg-emerald-500/5'
        : 'border-border-subtle bg-surface-2/20'
  return (
    <section className={`rounded-lg border p-4 ${border}`}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">{title}</h3>
      {children}
    </section>
  )
}

export function ResponseOrchestrationDetailPage() {
  const { incidentId } = useParams<{ incidentId: string }>()
  const detail = useResponseDetail(incidentId)
  const briefing = useResponseBriefing(incidentId)
  const history = useResponseHistory(incidentId)
  const actions = useResponseDecisionActions(incidentId)
  const canApprove = useHasPermission('responses.approve')
  const canModify = useHasPermission('responses.modify')
  const canReject = useHasPermission('responses.reject')

  const incidentQuery = useIncidentDetail(incidentId)
  const [modifyOpen, setModifyOpen] = useState(false)
  const [modifiedDecision, setModifiedDecision] = useState('')
  const [rationale, setRationale] = useState('')

  const data = detail.data
  const decision = data?.decision as Record<string, unknown> | null | undefined
  const recommendation = data?.recommendation as Record<string, unknown> | null | undefined
  const actionRows = (data?.actions as Array<Record<string, unknown>>) ?? []
  const notifications = (data?.notification_directives as Array<Record<string, unknown>>) ?? []

  if (detail.isLoading) return <p className="p-6 text-sm text-text-tertiary">Cargando respuesta…</p>
  if (detail.isError || !data) {
    return <p className="p-6 text-sm text-confidence-low">No se pudo cargar la respuesta.</p>
  }

  if (data.ownership_unresolved) {
    return (
      <div className="p-6">
        <PageHeader
          title="Organización pendiente"
          subtitle="Este incidente no tiene organización asignada."
        />
        <p className="mt-4 text-sm text-text-secondary">
          No se genera evaluación de respuesta hasta asignar organización. Requiere revisión administrativa.
        </p>
        <Link to="/respuesta" className="mt-4 inline-block text-sm text-accent hover:underline">
          Volver al listado
        </Link>
      </div>
    )
  }

  const decisionId = decision?.id as string | undefined
  const decisionStatus = String(decision?.decision_status ?? 'recommended')
  const canActOnDecision = decisionId && !['superseded', 'cancelled'].includes(decisionStatus)

  const incDetail = incidentQuery.data
  const members = (incDetail?.members as Array<Record<string, unknown>> | undefined) ?? []
  const primaryMember = members.find((m) => m.membership_role === 'primary') ?? members[0]
  const displayName = incDetail
    ? buildIncidentDisplayName({
        incident_type: String(incDetail.incident_type),
        status: String(incDetail.status),
        event_count: Number(incDetail.event_count),
        department_name: primaryMember?.department_name as string | null | undefined,
        lifecycle_state: primaryMember?.lifecycle_state as string | null | undefined,
      })
    : 'Incidente'
  const breadcrumbLabel = incDetail
    ? buildIncidentBreadcrumbLabel({
        incident_type: String(incDetail.incident_type),
        department_name: primaryMember?.department_name as string | null | undefined,
        lifecycle_state: primaryMember?.lifecycle_state as string | null | undefined,
        event_count: Number(incDetail.event_count),
      })
    : 'Incidente'

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6" data-testid="response-detail-page">
      <PageHeader
        title={`Respuesta · ${displayName}`}
        subtitle="Recomendación de TerraMind y decisión humana están separadas."
        breadcrumbs={[
          { label: 'Situación Nacional', to: '/situacion' },
          { label: 'Respuesta', to: '/respuesta' },
          { label: breadcrumbLabel },
        ]}
        meta={<ResponseStatusBadge badge={String(data.badge ?? 'pendiente_decision')} />}
      />

      <IntelligenceFlowSections resourceType="response" resourceId={incidentId} />

      <div className="mt-6 space-y-4">
        <Section title="1. Contexto del incidente">
          <pre className="overflow-x-auto text-xs text-text-secondary">
            {JSON.stringify(data.incident, null, 2)}
          </pre>
        </Section>

        <Section title="2. Evidencia y resolución">
          <p className="text-sm text-text-secondary">
            Ver resolución de verificación en{' '}
            <Link to={`/incidentes/${incidentId}`} className="text-accent hover:underline">
              detalle del incidente
            </Link>
            .
          </p>
        </Section>

        <Section title="Recomienda TerraMind" variant="recommended">
          {recommendation ? (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-text-tertiary">Nivel:</span>{' '}
                {responseLevelLabel(String(recommendation.recommendedResponseLevel))}
              </p>
              <p>
                <span className="text-text-tertiary">Urgencia:</span> {String(recommendation.urgency)}
              </p>
              <Badge variant="warning">Recomendación — no es decisión aprobada</Badge>
            </div>
          ) : (
            <OperationalEmptyState
              title="Sin evaluación de respuesta"
              explanation="Aún no existe una evaluación de respuesta. Se generará después de resolver una verificación."
              primaryCta={{ label: 'Ver incidente', to: `/incidentes/${incidentId}` }}
            />
          )}
        </Section>

        <Section title="4. Rationale">
          <ul className="list-inside list-disc text-sm text-text-secondary">
            {((recommendation?.rationaleCodes as string[]) ?? []).map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </Section>

        <Section title="5. Incertidumbres bloqueantes">
          <ul className="list-inside list-disc text-sm text-text-secondary">
            {((recommendation?.blockingUncertainties as Array<{ description: string }>) ?? []).map(
              (u, i) => (
                <li key={i}>{u.description}</li>
              ),
            )}
            {((recommendation?.blockingUncertainties as unknown[]) ?? []).length === 0 && (
              <li>Ninguna bloqueante registrada.</li>
            )}
          </ul>
        </Section>

        <Section title="6. Autoridad requerida">
          <pre className="text-xs text-text-secondary">
            {JSON.stringify(recommendation?.requiredAuthority ?? {}, null, 2)}
          </pre>
        </Section>

        <Section title="Decisión humana" variant="decision">
          {decision ? (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-text-tertiary">Estado:</span>{' '}
                {decisionStatusLabel(decisionStatus)}
              </p>
              <p>
                <span className="text-text-tertiary">Decisión:</span> {String(decision.decision)}
              </p>
              <p>
                <span className="text-text-tertiary">Rationale:</span> {String(decision.rationale)}
              </p>
              {recommendation && String(decision.decision) !== String(recommendation.recommendedResponseLevel) && (
                <p className="text-xs text-amber-400">
                  Difiere de la recomendación ({String(recommendation.recommendedResponseLevel)}).
                </p>
              )}
              {canActOnDecision && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {canApprove && decisionStatus !== 'approved' && (
                    <button
                      type="button"
                      className="rounded border border-emerald-500/40 px-3 py-1 text-xs text-emerald-300"
                      onClick={() => actions.approve.mutate(decisionId!)}
                    >
                      Aprobar
                    </button>
                  )}
                  {canModify && (
                    <button
                      type="button"
                      className="rounded border border-border-subtle px-3 py-1 text-xs"
                      onClick={() => setModifyOpen((v) => !v)}
                    >
                      Modificar
                    </button>
                  )}
                  {canReject && (
                    <button
                      type="button"
                      className="rounded border border-red-500/40 px-3 py-1 text-xs text-red-300"
                      onClick={() => {
                        const r = window.prompt('Rationale obligatorio para rechazar:')
                        if (r?.trim()) actions.reject.mutate({ decisionId: decisionId!, rationale: r })
                      }}
                    >
                      Rechazar
                    </button>
                  )}
                </div>
              )}
              {modifyOpen && canModify && decisionId && (
                <div className="mt-3 space-y-2">
                  <input
                    className="w-full rounded border border-border-subtle bg-surface-1 px-2 py-1 text-xs"
                    placeholder="Decisión modificada"
                    value={modifiedDecision}
                    onChange={(e) => setModifiedDecision(e.target.value)}
                  />
                  <textarea
                    className="w-full rounded border border-border-subtle bg-surface-1 px-2 py-1 text-xs"
                    placeholder="Rationale obligatorio"
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                  />
                  <button
                    type="button"
                    className="rounded bg-accent/20 px-3 py-1 text-xs"
                    onClick={() => {
                      if (!modifiedDecision || !rationale.trim()) return
                      actions.modify.mutate({
                        decisionId,
                        modified_decision: modifiedDecision,
                        rationale,
                        updated_at: String(decision.updated_at),
                      })
                      setModifyOpen(false)
                    }}
                  >
                    Confirmar modificación
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">Sin decisión registrada.</p>
          )}
        </Section>

        <Section title="8. Acciones">
          <ul className="space-y-2 text-sm">
            {actionRows.map((a) => (
              <li key={String(a.id)} className="rounded border border-border-subtle p-2">
                <p className="font-medium">{String(a.action_type)}</p>
                <p className="text-xs text-text-tertiary">
                  Estado: {String(a.status)} · Prioridad: {String(a.priority)}
                  {a.external_reference ? (
                    <>
                      {' '}
                      ·{' '}
                      <Link to={String(a.external_reference)} className="text-accent hover:underline">
                        Misión vinculada
                      </Link>
                    </>
                  ) : null}
                </p>
              </li>
            ))}
            {actionRows.length === 0 && <li className="text-text-tertiary">Sin acciones.</li>}
          </ul>
        </Section>

        <Section title="9. Communication directives (drafts)">
          <ul className="space-y-2 text-sm">
            {notifications.map((n) => (
              <li key={String(n.id)} className="rounded border border-border-subtle p-2">
                {String(n.audience_type)} · {String(n.channel_type)} · {String(n.urgency)}
                {n.approval_required ? ' · requiere aprobación' : ''}
              </li>
            ))}
            {notifications.length === 0 && (
              <li className="text-text-tertiary">Sin borradores de notificación.</li>
            )}
          </ul>
        </Section>

        <Section title="10. Recomendación de cierre">
          <p className="text-sm text-text-secondary">
            {(data.assessment as Record<string, unknown>)?.closure_recommendation
              ? String((data.assessment as Record<string, unknown>).closure_recommendation)
              : 'No disponible'}
          </p>
        </Section>

        <Section title="11. Historial">
          <ul className="space-y-1 text-xs text-text-tertiary">
            {(history.data?.items ?? []).map((e) => {
              const ev = e as Record<string, unknown>
              return (
                <li key={String(ev.id)}>
                  {formatGuatemalaDateTime(String(ev.created_at))} — {String(ev.event_type)}
                </li>
              )
            })}
          </ul>
        </Section>

        {briefing.data?.briefing && (
          <Section title="Briefing determinístico">
            <pre className="max-h-64 overflow-auto text-xs text-text-secondary">
              {JSON.stringify(briefing.data.briefing, null, 2)}
            </pre>
          </Section>
        )}
      </div>
    </div>
  )
}
