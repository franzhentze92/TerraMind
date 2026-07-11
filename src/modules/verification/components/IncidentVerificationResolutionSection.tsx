import { Badge } from '@/shared/components/Badge'
import { OperationalEmptyState } from '@/shared/components'
import { useIncidentVerificationResolution } from '../hooks/useVerificationResolution'
import { useIncidentVerificationPlan } from '../hooks/useVerificationPlans'
import { needResolutionStatusLabel } from '../utils/verification-labels'

interface Props {
  incidentId: string
  /**
   * When true, the "no requiere resolución" empty state is not rendered on its
   * own. Used in the incident detail page where the verification plan section
   * already communicates the consolidated "no requiere verificación" result.
   */
  suppressNotRequired?: boolean
}

export function IncidentVerificationResolutionSection({
  incidentId,
  suppressNotRequired = false,
}: Props) {
  const query = useIncidentVerificationResolution(incidentId)
  const planQuery = useIncidentVerificationPlan(incidentId)
  const data = query.data
  const plan = planQuery.data
  const planNeeds = (plan?.needs as unknown[] | undefined) ?? []
  // Verification only "requires" resolution when the plan has active needs.
  const verificationRequired = Boolean(plan) && planNeeds.length > 0

  if (query.isLoading || planQuery.isLoading) {
    return (
      <section className="rounded-lg border border-border-subtle bg-surface-2/30 p-4">
        <p className="text-sm text-text-tertiary">Cargando resolución de verificación…</p>
      </section>
    )
  }

  if (query.isError || !data) return null

  const counts = (data.resolution_counts as Record<string, number> | undefined) ?? {}
  const resolutions = (data.resolutions as Array<Record<string, unknown>> | undefined) ?? []
  const pending = (data.pending_reevaluations as Array<Record<string, unknown>> | undefined) ?? []
  const keyEvidence = (data.key_evidence as Array<Record<string, unknown>> | undefined) ?? []

  if (resolutions.length === 0) {
    if (!verificationRequired) {
      // The verification plan section already shows the consolidated
      // "no requiere verificación" block, so avoid repeating the idea.
      if (suppressNotRequired) return null
      return (
        <section id="resolucion" className="scroll-mt-6 rounded-lg border border-border-subtle bg-surface-2/30 p-4">
          <OperationalEmptyState
            compact
            title="No se requiere resolución de verificación"
            explanation="El plan determinó que no existen preguntas activas que deban resolverse mediante evidencia adicional."
            status="not_required"
          />
        </section>
      )
    }
    return (
      <section id="resolucion" className="scroll-mt-6 rounded-lg border border-border-subtle bg-surface-2/30 p-4">
        <OperationalEmptyState
          compact
          title="Resolución pendiente de evidencia"
          explanation="La resolución se genera después de validar evidencia suficiente para responder las preguntas de verificación activas."
          sourceProcess="Evidencia validada → resolución de verificación"
          status="pending"
        />
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-border-subtle bg-surface-2/30 p-4">
      <h2 className="mb-3 text-sm font-semibold text-text-primary">Resolución de verificación</h2>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {counts.satisfied ? (
          <Badge variant="default">Satisfechas {counts.satisfied}</Badge>
        ) : null}
        {counts.partially_satisfied ? (
          <Badge variant="default">Parciales {counts.partially_satisfied}</Badge>
        ) : null}
        {counts.inconclusive ? (
          <Badge variant="default">Inconclusas {counts.inconclusive}</Badge>
        ) : null}
        {(counts.open ?? 0) + (counts.insufficient_evidence ?? 0) > 0 ? (
          <Badge variant="default">
            Abiertas {(counts.open ?? 0) + (counts.insufficient_evidence ?? 0)}
          </Badge>
        ) : null}
        {counts.conflicting_evidence ? (
          <Badge variant="default">Conflictivas {counts.conflicting_evidence}</Badge>
        ) : null}
      </div>

      {keyEvidence.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] uppercase tracking-wider text-text-tertiary">Evidencia clave</p>
          <ul className="mt-1 list-inside list-disc text-xs text-text-secondary">
            {keyEvidence.slice(0, 5).map((e) => (
              <li key={String(e.validation_id)}>
                Validación {String(e.validation_id).slice(0, 8)}… · fuerza {String(e.strength)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {pending.length > 0 && (
        <p className="text-[11px] text-text-tertiary">
          Cambios derivados pendientes: {pending.map((p) => String(p.effect_type)).join(', ')}
        </p>
      )}

      <div className="mt-3 space-y-2">
        {resolutions.slice(0, 6).map((r) => {
          const uncertainties = (r.remaining_uncertainties as string[] | undefined) ?? []
          const followUp = (r.recommended_follow_up as string[] | undefined) ?? []
          return (
            <div
              key={String(r.id)}
              className="rounded border border-border-subtle/60 bg-surface-1/40 p-2 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-text-primary">Pregunta de verificación</span>
                <Badge variant="default">
                  {needResolutionStatusLabel(String(r.resolution_status))}
                </Badge>
                <span className="text-text-tertiary">
                  Confianza {String(r.resolution_confidence_score ?? r.resolution_confidence)}
                </span>
              </div>
              {uncertainties.length > 0 && (
                <p className="mt-1 text-text-tertiary">Incertidumbre: {uncertainties[0]}</p>
              )}
              {followUp.length > 0 && (
                <p className="mt-0.5 text-text-tertiary">Seguimiento: {followUp[0]}</p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
