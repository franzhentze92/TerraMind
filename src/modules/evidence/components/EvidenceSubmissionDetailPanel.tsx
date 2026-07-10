import { useEvidenceSubmissionDetail } from '../hooks/useMissionEvidence'
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
  const detail = query.data

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

      {assets.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-text-primary">Archivos</p>
          {assets.map((a) => (
            <div key={String(a.id)} className="mt-2 rounded border border-border-subtle px-2 py-1 text-xs">
              <p>{String(a.original_filename)}</p>
              <p className="text-text-tertiary">
                {String(a.mime_type)} · {String(a.size_bytes)} bytes
              </p>
              {a.checksum_sha256 && (
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
