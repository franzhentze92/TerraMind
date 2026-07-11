import { Link, useParams } from 'react-router-dom'
import { useState } from 'react'
import { ModuleHeader } from '@/shared/components'
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
        <ModuleHeader title="Ownership sin resolver" description="Este incidente no tiene organización asignada." />
        <p className="mt-4 text-sm text-text-secondary">
          No se generan assessments tenant-owned. Requiere revisión administrativa y estrategia de backfill.
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

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <div className="mb-4 flex items-center gap-3">
        <Link to="/respuesta" className="text-xs text-accent hover:underline">
          ← Respuesta
        </Link>
        <ResponseStatusBadge badge={String(data.badge ?? 'pendiente_decision')} />
      </div>

      <ModuleHeader
        title={`Respuesta · incidente ${incidentId?.slice(0, 8)}…`}
        description="Recomendación del motor y decisión humana están separadas. Ninguna acción de alto riesgo se autoejecuta."
      />

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

        <Section title="3. Recomendación del motor" variant="recommended">
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
            <p className="text-sm text-text-tertiary">Sin assessment activo.</p>
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

        <Section title="7. Decisión humana" variant="decision">
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
