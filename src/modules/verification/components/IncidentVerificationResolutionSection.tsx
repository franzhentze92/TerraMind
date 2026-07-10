import { Badge } from '@/shared/components/Badge'
import { useIncidentVerificationResolution } from '../hooks/useVerificationResolution'
import { needResolutionStatusLabel } from '../utils/verification-labels'

interface Props {
  incidentId: string
}

export function IncidentVerificationResolutionSection({ incidentId }: Props) {
  const query = useIncidentVerificationResolution(incidentId)
  const data = query.data

  if (query.isLoading) {
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

  if (resolutions.length === 0) return null

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
                <span className="font-medium text-text-primary">
                  Need {String(r.verification_need_id).slice(0, 8)}…
                </span>
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
