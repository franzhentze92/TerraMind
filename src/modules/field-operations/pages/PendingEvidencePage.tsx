import { Link } from 'react-router-dom'
import { useState } from 'react'

import { usePendingSyncBundles } from '@/modules/field-operations/field-sync/hooks/useFieldSync'

export function PendingEvidencePage() {
  const sync = usePendingSyncBundles()
  const [message, setMessage] = useState<string | null>(null)

  const totalBytes = sync.bundles.reduce((s, b) => s + b.size_bytes, 0)

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <div className="mb-6">
        <Link to="/campo/paquetes" className="text-sm text-accent hover:underline">
          ← Paquetes de campo
        </Link>
        <h1 className="mt-2 text-xl font-medium text-text-primary">Evidencia pendiente</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Sincronización resumible e idempotente hacia evidence submissions (8B.7D). La evidencia local se conserva hasta confirmación remota.
        </p>
      </div>

      {sync.loading && <p className="text-sm text-text-tertiary">Cargando…</p>}

      {!sync.loading && sync.bundles.length === 0 && (
        <p className="text-sm text-text-tertiary">No hay bundles pendientes de sincronización.</p>
      )}

      {!sync.loading && sync.bundles.length > 0 && (
        <>
          <p className="mb-4 text-sm text-text-secondary">
            Total: {sync.bundles.length} bundle(s) · {(totalBytes / (1024 * 1024)).toFixed(2)} MB
          </p>
          <ul className="space-y-3">
            {sync.bundles.map((b) => {
              const session = sync.sessions.find(
                (s) => s.bundle_id === b.bundle_id && s.bundle_checksum === b.bundle_checksum,
              )
              return (
                <li key={b.bundle_id} className="rounded border border-border-subtle bg-surface-2/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-text-primary">Tarea {b.task_id.slice(0, 8)}…</p>
                      <p className="text-xs text-text-tertiary">
                        Paquete {b.package_id.slice(0, 8)}… · v{b.package_version}
                      </p>
                      <p className="text-xs text-text-tertiary">
                        {b.captured_at_range.start
                          ? new Date(b.captured_at_range.start).toLocaleString()
                          : '—'}
                      </p>
                    </div>
                    <span className="rounded bg-accent/10 px-2 py-1 text-xs text-accent">
                      {session?.status ?? b.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-text-secondary">
                    {b.evidence_record_ids.length} registro(s) · {(b.size_bytes / 1024).toFixed(1)} KB
                  </p>
                  {session && (
                    <p className="mt-1 text-xs text-text-tertiary">
                      Progreso: {session.bytes_transferred}/{session.bytes_total} bytes
                      {session.last_error ? ` · Error: ${session.last_error}` : ''}
                      {session.next_retry_at ? ` · Reintento: ${new Date(session.next_retry_at).toLocaleString()}` : ''}
                    </p>
                  )}
                  {b.limitations.length > 0 && (
                    <p className="mt-1 text-xs text-confidence-medium">
                      Limitaciones: {b.limitations.join(', ')}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded border border-accent/40 px-3 py-1.5 text-xs text-accent"
                      onClick={() => {
                        void sync.syncNow(b).then((r) => {
                          setMessage(
                            r.ok
                              ? 'Sincronización completada — submission en ready_for_validation.'
                              : `Sincronización no completada: ${r.reason ?? 'error'}`,
                          )
                        })
                      }}
                    >
                      Sincronizar ahora
                    </button>
                    {session && session.status === 'syncing' && (
                      <button
                        type="button"
                        className="rounded border border-border-subtle px-3 py-1.5 text-xs"
                        onClick={() => void sync.pause(session.session_id)}
                      >
                        Pausar
                      </button>
                    )}
                    {session && !session.cancelled && session.status !== 'synced' && (
                      <button
                        type="button"
                        className="rounded border border-border-subtle px-3 py-1.5 text-xs"
                        onClick={() => void sync.cancel(session.session_id)}
                      >
                        Cancelar sesión
                      </button>
                    )}
                    <Link
                      to={`/campo/paquetes/${b.package_id}/tareas/${b.task_id}`}
                      className="rounded border border-border-subtle px-3 py-1.5 text-xs hover:underline"
                    >
                      Ver tarea
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {message && <p className="mt-4 text-sm text-text-secondary">{message}</p>}
    </div>
  )
}
