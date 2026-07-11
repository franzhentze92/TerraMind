import { useEvidenceSubmissionDetail, useEvidenceValidation } from '../hooks/useMissionEvidence'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'

interface EvidenceSubmissionDetailPanelProps {
  submissionId: string
  onClose: () => void
}

export function EvidenceSubmissionDetailPanel({
  submissionId,
  onClose,
}: EvidenceSubmissionDetailPanelProps) {
  const query = useEvidenceSubmissionDetail(submissionId)
  const validationQuery = useEvidenceValidation(submissionId)
  const detail = query.data
  const validation = validationQuery.data?.validation as Record<string, unknown> | undefined
  const checks = (validationQuery.data?.checks as Array<Record<string, unknown>>) ?? []

  if (query.isLoading) {
    return (
      <div className="mt-4 rounded border border-border-subtle p-4 text-xs text-text-tertiary">
        Cargando detalle…
      </div>
    )
  }
  if (!detail) return null

  const submission = detail.submission as Record<string, unknown>
  const assets = (detail.assets as Array<Record<string, unknown>>) ?? []
  const observation = detail.observation as Record<string, unknown> | null
  const links = (detail.requirement_links as Array<Record<string, unknown>>) ?? []
  const events = (detail.intake_events as Array<Record<string, unknown>>) ?? []

  return (
    <div className="mt-4 rounded-lg border border-border-subtle bg-surface-2/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Detalle de evidencia</h3>
        <button type="button" onClick={onClose} className="text-xs text-text-tertiary hover:text-accent">
          Cerrar
        </button>
      </div>

      <div className="space-y-2 text-xs">
        <p>
          <span className="text-text-tertiary">Estado:</span>{' '}
          <span className="text-text-primary">{String(submission.status)}</span>
        </p>
        <p>
          <span className="text-text-tertiary">Tipo:</span>{' '}
          {String(submission.evidence_type)}
        </p>
        <p>
          <span className="text-text-tertiary">Submitter:</span>{' '}
          {String(submission.submitted_by_id)}
        </p>
        <p>
          <span className="text-text-tertiary">Capturada:</span>{' '}
          {submission.captured_at
            ? formatGuatemalaDateTime(String(submission.captured_at))
            : '—'}
        </p>
        <p>
          <span className="text-text-tertiary">Entregada:</span>{' '}
          {formatGuatemalaDateTime(String(submission.submitted_at))}
        </p>
        {Boolean(submission.location_outside_mission_area) && (
          <p className="text-confidence-low">Ubicación marcada fuera del área de misión</p>
        )}
      </div>

      {validation && (
        <div className="mt-4 rounded border border-border-subtle/80 bg-surface-1/30 p-3">
          <p className="text-xs font-medium text-text-primary">Validación de calidad</p>
          <p className="mt-1 text-xs text-text-secondary">
            Estado: {String(validation.status)} · Fuerza: {String(validation.evidence_strength)}
          </p>
          <p className="text-xs text-text-tertiary">
            Calidad general: {String(validation.overall_quality_score)}/100
          </p>
          <p className="mt-1 text-xs text-text-secondary">{String(validation.decision_reason)}</p>
          {((validation.limitations as string[]) ?? []).length > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs text-confidence-low">
              {((validation.limitations as string[]) ?? []).map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
          <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-text-tertiary">
            <span>Integridad: {String(validation.technical_integrity_score)}</span>
            <span>Provenance: {String(validation.provenance_score)}</span>
            <span>Temporal: {String(validation.temporal_relevance_score)}</span>
            <span>Espacial: {String(validation.spatial_relevance_score)}</span>
            <span>Semántica: {String(validation.semantic_relevance_score)}</span>
            <span>Completitud: {String(validation.completeness_score)}</span>
            <span>Independencia: {String(validation.source_independence_score)}</span>
            <span>Usabilidad: {String(validation.usability_score)}</span>
          </div>
          {checks.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] font-medium text-text-primary">Checks</p>
              {checks.slice(0, 6).map((c) => (
                <p key={String(c.id)} className="text-[10px] text-text-tertiary">
                  {String(c.dimension)} · {String(c.check_code)} · {String(c.outcome)}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {assets.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-text-primary">Archivos</p>
          {assets.map((a) => (
            <div key={String(a.id)} className="mt-2 rounded border border-border-subtle px-2 py-1 text-xs">
              <p>{String(a.original_filename)}</p>
              <p className="text-text-tertiary">
                {String(a.mime_type)} · {String(a.size_bytes)} bytes
              </p>
              {Boolean(a.checksum_sha256) && (
                <p className="text-text-tertiary">SHA-256: {String(a.checksum_sha256).slice(0, 16)}…</p>
              )}
              {Boolean(a.mime_extension_mismatch) && (
                <p className="text-confidence-low">Extensión y MIME no coinciden</p>
              )}
            </div>
          ))}
        </div>
      )}

      {observation && (
        <div className="mt-4">
          <p className="text-xs font-medium text-text-primary">Observación estructurada</p>
          <pre className="mt-1 overflow-x-auto rounded bg-surface-1/50 p-2 text-[10px] text-text-secondary">
            {JSON.stringify(observation.fields, null, 2)}
          </pre>
        </div>
      )}

      {links.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-text-primary">Cobertura preliminar por requisito</p>
          {links.map((l) => (
            <p key={String(l.id)} className="mt-1 text-xs text-text-secondary">
              {String(l.requirement_id).slice(0, 8)}… · {String(l.match_type)} ·{' '}
              {String(l.preliminary_coverage)}
              {Boolean(l.valid_coverage_status) && ` · ${String(l.valid_coverage_status)}`}
            </p>
          ))}
        </div>
      )}

      <div className="mt-4">
        <p className="text-xs font-medium text-text-primary">Timeline de intake</p>
        {events.map((e) => (
          <p key={String(e.id)} className="mt-1 text-xs text-text-tertiary">
            {String(e.event_type)} · {formatGuatemalaDateTime(String(e.created_at))}
          </p>
        ))}
      </div>
    </div>
  )
}
