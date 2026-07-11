import { Badge } from '@/shared/components/Badge'
import { OperationalEmptyState } from '@/shared/components'
import { useIncidentVerificationPlan } from '../hooks/useVerificationPlans'
import { usePlanResolutionSummary } from '../hooks/useVerificationResolution'
import {
  needResolutionStatusLabel,
  verificationMethodLabel,
  verificationNeedTypeLabel,
  verificationPlanStatusLabel,
} from '../utils/verification-labels'

interface Props {
  incidentId: string
}

export function VerificationPlanSection({ incidentId }: Props) {
  const query = useIncidentVerificationPlan(incidentId)
  const plan = query.data
  const resolutionQuery = usePlanResolutionSummary(plan?.id ? String(plan.id) : undefined)
  const resolutionByNeed = new Map(
    ((resolutionQuery.data?.needs as Array<Record<string, unknown>> | undefined) ?? []).map((n) => [
      String(n.need_id),
      n.resolution as Record<string, unknown> | null,
    ]),
  )

  if (query.isLoading) {
    return (
      <section className="rounded-lg border border-border-subtle bg-surface-2/30 p-4">
        <p className="text-sm text-text-tertiary">Cargando plan de verificación…</p>
      </section>
    )
  }

  if (query.isError || !plan) {
    return (
      <section id="verificacion" className="scroll-mt-6 rounded-lg border border-border-subtle bg-surface-2/30 p-4">
        <OperationalEmptyState
          compact
          title="No existen preguntas activas de verificación"
          explanation="El sistema no ha identificado incertidumbres que requieran una acción adicional para este incidente."
          status="not_required"
        />
      </section>
    )
  }

  const needs = (plan.needs as Array<Record<string, unknown>> | undefined) ?? []
  const limitations = (plan.plan_limitations as string[] | undefined) ?? []
  const reasons = (plan.plan_reasons as string[] | undefined) ?? []
  const window = plan.recommended_window as { label?: string; end_hours?: number } | undefined

  return (
    <section className="rounded-lg border border-border-subtle bg-surface-2/30 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-text-primary">Plan de verificación</h2>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="default">{verificationPlanStatusLabel(String(plan.status))}</Badge>
          <Badge variant="default">Prioridad {String(plan.plan_priority)}</Badge>
        </div>
      </div>

      {reasons.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] uppercase tracking-wider text-text-tertiary">
            Por qué necesita verificarse
          </p>
          <ul className="mt-1 list-inside list-disc text-xs text-text-secondary">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {needs.length === 0 ? (
        <OperationalEmptyState
          compact
          title="No se requiere verificación adicional"
          explanation="La revisión remota o el contexto actual es suficiente para las preguntas abiertas."
          status="not_required"
        />
      ) : (
        <div className="space-y-4">
          {needs.map((need) => {
            const methods = (need.methods as Array<Record<string, unknown>> | undefined) ?? []
            const recommended = methods.find((m) => m.is_recommended)
            const alternatives = methods.filter((m) => m.is_alternative)
            const evidenceMin = (need.evidence_minimum as string[] | undefined) ?? []
            const resolution = resolutionByNeed.get(String(need.id))
            const bundle = resolution?.evidence_bundle as
              | { validations_used?: string[]; limitations?: string[] }
              | undefined
            const conflict = resolution?.conflict_assessment as
              | { status?: string; reasons?: string[] }
              | undefined

            return (
              <div
                key={String(need.id)}
                className="rounded-md border border-border-subtle/60 bg-surface-1/40 p-3"
              >
                <p className="text-xs font-medium text-text-primary">
                  {verificationNeedTypeLabel(String(need.need_type))}
                </p>
                <p className="mt-1 text-xs text-text-secondary">{String(need.need_question)}</p>

                {resolution && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge variant="default">
                      {needResolutionStatusLabel(String(resolution.resolution_status))}
                    </Badge>
                    <span className="text-[11px] text-text-tertiary">
                      Confianza {String(resolution.resolution_confidence_score ?? resolution.resolution_confidence)} ·
                      Fuerza {String(resolution.resolution_strength)}
                    </span>
                  </div>
                )}

                {bundle?.validations_used && bundle.validations_used.length > 0 && (
                  <p className="mt-1 text-[11px] text-text-tertiary">
                    Evidencias utilizadas: {bundle.validations_used.length}
                  </p>
                )}

                {conflict?.status && conflict.status !== 'none' && (
                  <p className="mt-1 text-[11px] text-text-tertiary">
                    Conflicto: {conflict.status}
                    {conflict.reasons?.[0] ? ` — ${conflict.reasons[0]}` : ''}
                  </p>
                )}

                {(resolution?.remaining_uncertainties as string[] | undefined)?.[0] && (
                  <p className="mt-1 text-[11px] text-text-tertiary">
                    Incertidumbre: {(resolution?.remaining_uncertainties as string[])[0]}
                  </p>
                )}

                {(resolution?.recommended_follow_up as string[] | undefined)?.[0] && (
                  <p className="mt-1 text-[11px] text-text-tertiary">
                    Seguimiento: {(resolution?.recommended_follow_up as string[])[0]}
                  </p>
                )}

                {recommended && (
                  <p className="mt-2 text-xs text-text-secondary">
                    <span className="text-text-tertiary">Método recomendado: </span>
                    {verificationMethodLabel(String(recommended.method_id))}
                  </p>
                )}

                {alternatives.length > 0 && (
                  <p className="mt-1 text-xs text-text-tertiary">
                    Alternativas:{' '}
                    {alternatives
                      .map((a) => verificationMethodLabel(String(a.method_id)))
                      .join(' · ')}
                  </p>
                )}

                {evidenceMin.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] uppercase tracking-wider text-text-tertiary">
                      Evidencia mínima
                    </p>
                    <ul className="mt-0.5 list-inside list-disc text-xs text-text-secondary">
                      {evidenceMin.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {need.selection_reason && (
                  <p className="mt-2 text-[11px] text-text-tertiary">
                    {String(need.selection_reason)}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {window?.label && (
        <p className="mt-3 text-xs text-text-secondary">
          Ventana recomendada: {window.label}
          {window.end_hours ? ` (${window.end_hours}h)` : ''}
        </p>
      )}

      {limitations.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] uppercase tracking-wider text-text-tertiary">Restricciones</p>
          <ul className="mt-1 list-inside list-disc text-xs text-text-tertiary">
            {limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      )}

      {plan.mission_candidate_pending && (
        <p className="mt-3 text-[11px] text-text-tertiary">
          Plan listo para evaluación de misión futura (sin asignación todavía).
        </p>
      )}
    </section>
  )
}
