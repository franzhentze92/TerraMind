import { Link } from 'react-router-dom'

import { OperationalEmptyState, OperationalCardSkeleton } from '@/shared/components'
import { useFieldCampo } from '@/modules/field-operations/field-mobile/hooks/useFieldCampo'
import { t } from '@/modules/field-operations/field-mobile/i18n/field-mobile-i18n'
import { useRealSyncPilot } from '@/modules/field-operations/field-sync/hooks/useRealSyncPilot'

function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function connectivityLabel(state: string): string {
  if (state === 'online') return 'Conectado'
  if (state === 'offline') return 'Sin conexión'
  return 'Conectividad limitada'
}

export function FieldCampoHomePage() {
  const campo = useFieldCampo('es')
  const s = campo.summary
  const pilot = useRealSyncPilot(s?.active_mission_id ?? null)

  const hasWork =
    s &&
    (s.active_mission_id ||
      s.packages_count > 0 ||
      s.pending_tasks > 0 ||
      s.pending_sync_bundles > 0 ||
      s.open_conflicts > 0)

  return (
    <div className="mx-auto max-w-lg p-4" data-testid="field-campo-home">
      <h1 className="text-xl font-medium text-text-primary">{t('do_now', 'es')}</h1>

      {campo.loading && (
        <div className="mt-4 space-y-3">
          <OperationalCardSkeleton />
          <OperationalCardSkeleton />
        </div>
      )}

      {!campo.loading && s && !hasWork && (
        <div className="mt-4 space-y-4">
          <OperationalEmptyState
            compact
            title="No tienes misiones asignadas"
            explanation="Cuando recibas una misión, podrás descargarla, trabajar sin conexión y sincronizar la evidencia al recuperar conexión."
            sourceProcess="Asignación de misión → paquete offline"
            primaryAction={{
              label: 'Actualizar misiones',
              onClick: () => void campo.refresh(),
            }}
          />
          <section className="rounded-lg border border-border-subtle p-3 text-xs text-text-secondary">
            <p>Estado de conexión: {connectivityLabel(s.connectivity)}</p>
            <p className="mt-1">Almacenamiento local: {formatBytes(s.local_storage_bytes)}</p>
            {!pilot.pilotActive && (
              <p className="mt-1 text-text-tertiary">
                La sincronización todavía no está habilitada para esta cuenta. El trabajo local
                permanecerá guardado.
              </p>
            )}
          </section>
        </div>
      )}

      {!campo.loading && s && hasWork && (
        <div className="mt-4 space-y-3">
          <section className="rounded-lg border border-border-subtle bg-surface-2/30 p-4">
            <p className="text-sm font-medium text-text-primary">{s.next_action}</p>
            {s.active_mission_title && (
              <p className="mt-1 text-xs text-text-secondary">Misión: {s.active_mission_title}</p>
            )}
            {s.blocked_reason && (
              <p className="mt-2 text-xs text-confidence-low">{s.blocked_reason}</p>
            )}
          </section>

          <section className="rounded-lg border border-border-subtle p-3 text-xs text-text-secondary">
            <p>Conexión: {connectivityLabel(s.connectivity)}</p>
            <p className="mt-1">Almacenamiento local: {formatBytes(s.local_storage_bytes)}</p>
            {s.packages_count > 0 && (
              <p className="mt-1">
                <Link to="/campo/paquetes" className="text-accent hover:underline">
                  {s.packages_count} paquete(s) descargado(s)
                </Link>
              </p>
            )}
          </section>

          {(s.pending_tasks > 0 || s.draft_forms > 0) && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              {s.pending_tasks > 0 && <Stat label="Tareas pendientes" value={s.pending_tasks} />}
              {s.draft_forms > 0 && <Stat label="Borradores" value={s.draft_forms} />}
            </div>
          )}

          {(s.pending_sync_bundles > 0 || s.open_conflicts > 0) && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              {s.pending_sync_bundles > 0 && (
                <Stat label="Pendiente de sincronización" value={s.pending_sync_bundles} />
              )}
              {s.open_conflicts > 0 && <Stat label="Conflictos" value={s.open_conflicts} />}
            </div>
          )}

          {s.overall_capture_pct > 0 && (
            <section className="rounded-lg border border-border-subtle p-3 text-xs">
              <ProgressRow label="Captura local" pct={s.overall_capture_pct} />
              {s.ready_for_sync_pct > 0 && (
                <ProgressRow label="Listo para sincronizar" pct={s.ready_for_sync_pct} />
              )}
              {s.synced_pct > 0 && (
                <ProgressRow label="Recibido por el servidor" pct={s.synced_pct} />
              )}
            </section>
          )}

          <div className="flex flex-col gap-2">
            {s.active_package_id && (
              <Link
                to={`/campo/paquetes/${s.active_package_id}`}
                className="rounded-lg border border-accent/40 bg-accent/5 px-4 py-3 text-center text-sm text-accent"
              >
                {t('continue_task', 'es')}
              </Link>
            )}
            {s.pending_sync_bundles > 0 && (
              <Link
                to="/campo/sincronizacion"
                className="rounded-lg border border-border-subtle px-4 py-3 text-center text-sm"
              >
                {t('prepare_sync', 'es')}
              </Link>
            )}
            {s.packages_count > 0 && (
              <Link
                to="/campo/paquetes"
                className="rounded-lg border border-border-subtle px-4 py-3 text-center text-sm text-text-secondary"
              >
                Ver paquetes descargados
              </Link>
            )}
            <button
              type="button"
              className="rounded-lg border border-border-subtle px-4 py-2 text-xs text-text-tertiary"
              onClick={() => void campo.refresh()}
            >
              Actualizar misiones
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-border-subtle bg-surface-2/20 p-2">
      <p className="text-text-tertiary">{label}</p>
      <p className="text-lg font-medium text-text-primary">{value}</p>
    </div>
  )
}

function ProgressRow({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="mt-2 first:mt-0">
      <div className="flex justify-between">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="mt-1 h-2 rounded bg-surface-2">
        <div className="h-2 rounded bg-accent/60" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  )
}
