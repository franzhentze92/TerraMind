import { Badge } from '@/shared/components/Badge'
import { useIncidentVerificationPlan } from '../hooks/useVerificationPlans'
import {
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

  if (query.isLoading) {
    return (
      <section className="rounded-lg border border-border-subtle bg-surface-2/30 p-4">
        <p className="text-sm text-text-tertiary">Cargando plan de verificación…</p>
      </section>
    )
  }

  if (query.isError || !plan) {
    return (
      <section className="rounded-lg border border-border-subtle bg-surface-2/30 p-4">
        <h2 className="mb-2 text-sm font-semibold text-text-primary">Plan de verificación</h2>
        <p className="text-sm text-text-tertiary">
          Sin plan de verificación activo para este incidente.
        </p>
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
        <p className="text-xs text-text-tertiary">Verificación no requerida en este momento.</p>
      ) : (
        <div className="space-y-4">
          {needs.map((need) => {
            const methods = (need.methods as Array<Record<string, unknown>> | undefined) ?? []
            const recommended = methods.find((m) => m.is_recommended)
            const alternatives = methods.filter((m) => m.is_alternative)
            const evidenceMin = (need.evidence_minimum as string[] | undefined) ?? []

            return (
              <div
                key={String(need.id)}
                className="rounded-md border border-border-subtle/60 bg-surface-1/40 p-3"
              >
                <p className="text-xs font-medium text-text-primary">
                  {verificationNeedTypeLabel(String(need.need_type))}
                </p>
                <p className="mt-1 text-xs text-text-secondary">{String(need.need_question)}</p>

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
