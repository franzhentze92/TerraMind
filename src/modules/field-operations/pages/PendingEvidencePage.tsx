import { Link } from 'react-router-dom'

import { usePendingEvidenceBundles } from '@/modules/field-operations/offline-evidence/hooks/useOfflineEvidence'

export function PendingEvidencePage() {
  const { bundles, loading, totalBytes } = usePendingEvidenceBundles()

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <div className="mb-6">
        <Link to="/campo/paquetes" className="text-sm text-accent hover:underline">
          ← Paquetes de campo
        </Link>
        <h1 className="mt-2 text-xl font-medium text-text-primary">Evidencia pendiente</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Bundles locales listos o bloqueados para sincronización futura (8B.7D). No hay upload en esta fase.
        </p>
      </div>

      {loading && <p className="text-sm text-text-tertiary">Cargando…</p>}

      {!loading && bundles.length === 0 && (
        <p className="text-sm text-text-tertiary">No hay bundles pendientes de sincronización.</p>
      )}

      {!loading && bundles.length > 0 && (
        <>
          <p className="mb-4 text-sm text-text-secondary">
            Total: {bundles.length} bundle(s) · {(totalBytes / (1024 * 1024)).toFixed(2)} MB
          </p>
          <ul className="space-y-3">
            {bundles.map((b) => (
              <li key={b.bundle_id} className="rounded border border-border-subtle bg-surface-2/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-text-primary">Tarea {b.task_id.slice(0, 8)}…</p>
                    <p className="text-xs text-text-tertiary">Paquete {b.package_id.slice(0, 8)}… · v{b.package_version}</p>
                    <p className="text-xs text-text-tertiary">
                      {b.captured_at_range.start
                        ? new Date(b.captured_at_range.start).toLocaleString()
                        : '—'}
                    </p>
                  </div>
                  <span
                    className={
                      b.status === 'sync_blocked'
                        ? 'rounded bg-confidence-low/20 px-2 py-1 text-xs text-confidence-low'
                        : 'rounded bg-accent/10 px-2 py-1 text-xs text-accent'
                    }
                  >
                    {b.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-text-secondary">
                  {b.evidence_record_ids.length} registro(s) · {(b.size_bytes / 1024).toFixed(1)} KB
                </p>
                {b.limitations.length > 0 && (
                  <p className="mt-1 text-xs text-confidence-medium">
                    Limitaciones: {b.limitations.join(', ')}
                  </p>
                )}
                <Link
                  to={`/campo/paquetes/${b.package_id}/tareas/${b.task_id}`}
                  className="mt-2 inline-block text-xs text-accent hover:underline"
                >
                  Ver tarea
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
