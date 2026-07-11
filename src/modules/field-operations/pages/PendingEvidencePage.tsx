import { Link } from 'react-router-dom'
import { useState } from 'react'

import { OperationalEmptyState, OperationalListSkeleton } from '@/shared/components'
import { labelSyncStatus, t } from '@/modules/field-operations/field-mobile/i18n/field-mobile-i18n'
import { usePendingSyncBundles } from '@/modules/field-operations/field-sync/hooks/useFieldSync'
import { useFieldMobileSync } from '@/modules/field-operations/field-mobile/hooks/useFieldMobileSync'

export function PendingEvidencePage() {
  const sync = usePendingSyncBundles()
  const fieldSync = useFieldMobileSync()
  const [message, setMessage] = useState<string | null>(null)

  const totalBytes = sync.bundles.reduce((s, b) => s + b.size_bytes, 0)

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6" data-testid="pending-evidence-page">
      <div className="mb-6">
        <Link to="/campo/paquetes" className="text-sm text-accent hover:underline">
          ← Paquetes de campo
        </Link>
        <h1 className="mt-2 text-xl font-medium text-text-primary">Evidencia pendiente</h1>
        <p className="mt-1 text-sm text-text-secondary">
          {fieldSync.realSyncEnabled
            ? 'Evidencia local lista para enviarse al servidor de forma resumible.'
            : 'La sincronización todavía no está habilitada para esta cuenta. El trabajo local permanecerá guardado.'}
        </p>
      </div>

      {sync.loading && <OperationalListSkeleton rows={2} />}

      {!sync.loading && sync.bundles.length === 0 && (
        <OperationalEmptyState
          title="No hay evidencia pendiente de sincronización"
          explanation="Las fotografías, observaciones y formularios capturados sin conexión aparecerán aquí antes de enviarse."
          sourceProcess="Captura en campo → cola local → sincronización"
          status={fieldSync.realSyncEnabled ? 'empty' : 'pending'}
        />
      )}

      {!sync.loading && sync.bundles.length > 0 && (
        <>
          <p className="mb-4 text-sm text-text-secondary">
            Total: {sync.bundles.length} envío(s) · {(totalBytes / (1024 * 1024)).toFixed(2)} MB
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
                    </div>
                    <span className="rounded bg-accent/10 px-2 py-1 text-xs text-accent">
                      {labelSyncStatus(session?.status ?? b.status)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-text-secondary">
                    {b.evidence_record_ids.length} registro(s) · {(b.size_bytes / 1024).toFixed(1)} KB
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {fieldSync.realSyncEnabled && (
                      <button
                        type="button"
                        className="rounded border border-accent/40 px-3 py-1.5 text-xs text-accent"
                        onClick={() => {
                          void sync.syncNow(b).then((r) => {
                            setMessage(
                              r.ok
                                ? t('received_by_server', 'es')
                                : `${t('needs_review', 'es')}: ${r.reason ?? 'error'}`,
                            )
                          })
                        }}
                      >
                        Sincronizar ahora
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
