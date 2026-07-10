import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'

import { useFieldMobileSync } from '@/modules/field-operations/field-mobile/hooks/useFieldMobileSync'
import { labelSyncStatus, t } from '@/modules/field-operations/field-mobile/i18n/field-mobile-i18n'
import { OfflineEvidenceRepository } from '@/modules/field-operations/offline-evidence/offline-evidence.repository'
import { OfflinePackageRepository } from '@/modules/field-operations/offline-packages/offline-package.repository'
import type { LocalEvidenceBundle } from '@/modules/field-operations/offline-evidence/offline-evidence.types'
import type { SyncSession } from '@/modules/field-operations/field-sync/field-sync.types'

export function FieldSyncPage() {
  const sync = useFieldMobileSync()
  const [bundles, setBundles] = useState<LocalEvidenceBundle[]>([])
  const [sessions, setSessions] = useState<SyncSession[]>([])
  const [message, setMessage] = useState<string | null>(null)

  const refresh = async () => {
    setBundles(await OfflineEvidenceRepository.createDefault().listBundles('pending_sync'))
    setSessions(await sync.listSessions())
  }

  useEffect(() => {
    void refresh()
  }, [])

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="text-lg font-medium text-text-primary">Sincronización</h1>
      <p className="mt-1 text-xs text-confidence-medium">
        {sync.realSyncEnabled ? t('sync_available', 'es') : 'Transport simulado — sin Supabase real'}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-accent/40 px-4 py-2 text-sm text-accent"
          disabled={sync.running || bundles.length === 0}
          onClick={() => {
            void (async () => {
              const pkgRepo = OfflinePackageRepository.createDefault()
              for (const b of bundles) {
                const pkg = await pkgRepo.read(b.package_id)
                if (!pkg) continue
                const r = await sync.syncBundleSafe(b, pkg)
                setMessage(r.ok ? t('received_by_server', 'es') : (r.reason ?? t('needs_review', 'es')))
              }
              await refresh()
            })()
          }}
        >
          Sincronizar todos (simulado)
        </button>
      </div>

      <ul className="mt-4 space-y-3">
        {bundles.map((b) => (
          <li key={b.bundle_id} className="rounded-lg border border-border-subtle p-3 text-sm">
            <p className="font-medium">Bundle {b.bundle_id.slice(0, 8)}…</p>
            <p className="text-xs text-text-tertiary">{labelSyncStatus(b.status)} · {(b.size_bytes / 1024).toFixed(1)} KB</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="text-xs text-accent"
                onClick={() => {
                  void (async () => {
                    const pkg = await OfflinePackageRepository.createDefault().read(b.package_id)
                    if (!pkg) return
                    const r = await sync.syncBundleSafe(b, pkg, { interruptAfterBytes: 5 })
                    setMessage(r.ok ? t('received_by_server', 'es') : t('network_interrupted', 'es'))
                    await refresh()
                  })()
                }}
              >
                {t('retry', 'es')}
              </button>
              <Link to={`/campo/paquetes/${b.package_id}/tareas/${b.task_id}`} className="text-xs text-text-secondary">
                Ver tarea
              </Link>
            </div>
          </li>
        ))}
      </ul>

      {sessions.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-medium">Sesiones</h2>
          <ul className="mt-2 space-y-2 text-xs">
            {sessions.map((s) => (
              <li key={s.session_id} className="rounded border border-border-subtle p-2">
                {labelSyncStatus(s.status)} · {s.bytes_transferred}/{s.bytes_total} bytes
                {s.last_error && <span className="text-confidence-low"> · {s.last_error}</span>}
                <div className="mt-1 flex gap-2">
                  <button type="button" onClick={() => void sync.pause(s.session_id).then(refresh)}>
                    {t('pause', 'es')}
                  </button>
                  <button type="button" onClick={() => void sync.cancel(s.session_id).then(refresh)}>
                    Cancelar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sync.lastResult && (
        <section className="mt-4 rounded border border-border-subtle p-3 text-xs">
          <p className="font-medium">Timeline simulado</p>
          <ol className="mt-1 list-decimal pl-4">
            {sync.lastResult.steps.map((s, i) => (
              <li key={i}>{t(s.message_key, 'es')}</li>
            ))}
          </ol>
        </section>
      )}

      {message && <p className="mt-4 text-sm text-text-secondary">{message}</p>}
    </div>
  )
}
