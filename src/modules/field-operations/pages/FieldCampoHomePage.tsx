import { Link } from 'react-router-dom'

import { useFieldCampo } from '@/modules/field-operations/field-mobile/hooks/useFieldCampo'
import { t } from '@/modules/field-operations/field-mobile/i18n/field-mobile-i18n'
import { FIELD_REAL_SYNC_ENABLED } from '@/modules/field-operations/field-mobile/config/fire-field-mobile.config'

function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function FieldCampoHomePage() {
  const campo = useFieldCampo('es')
  const s = campo.summary

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="text-xl font-medium text-text-primary">{t('do_now', 'es')}</h1>
      {!FIELD_REAL_SYNC_ENABLED && (
        <p className="mt-1 text-xs text-confidence-medium">
          Sync simulado — producción bloqueada hasta 8B.7F y staging confirmado.
        </p>
      )}

      {campo.loading && <p className="mt-4 text-sm text-text-tertiary">Cargando…</p>}

      {s && (
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

          <div className="grid grid-cols-2 gap-2 text-xs">
            <Stat label="Paquetes" value={s.packages_count} />
            <Stat label="Tareas pendientes" value={s.pending_tasks} />
            <Stat label="Borradores" value={s.draft_forms} />
            <Stat label="Pending sync" value={s.pending_sync_bundles} />
            <Stat label="Conflictos" value={s.open_conflicts} />
            <Stat label="Almacenamiento" value={formatBytes(s.local_storage_bytes)} />
          </div>

          <section className="rounded-lg border border-border-subtle p-3 text-xs">
            <p className="text-text-secondary">{t('work_local_only', 'es')}</p>
            <div className="mt-2 space-y-1">
              <ProgressRow label="Captura local" pct={s.overall_capture_pct} />
              <ProgressRow label="Listo sync" pct={s.ready_for_sync_pct} />
              <ProgressRow label="Recibido servidor (sim)" pct={s.synced_pct} />
            </div>
          </section>

          <div className="flex flex-col gap-2">
            {s.active_package_id && (
              <Link
                to={`/campo/paquetes/${s.active_package_id}`}
                className="rounded-lg border border-accent/40 bg-accent/5 px-4 py-3 text-center text-sm text-accent"
              >
                {t('continue_task', 'es')}
              </Link>
            )}
            <Link
              to="/campo/sincronizacion"
              className="rounded-lg border border-border-subtle px-4 py-3 text-center text-sm"
            >
              {t('prepare_sync', 'es')}
            </Link>
            <button
              type="button"
              className="rounded-lg border border-dashed border-border-subtle px-4 py-2 text-xs text-text-tertiary"
              onClick={() => void campo.installSyntheticDemo()}
            >
              Instalar paquete demo (fixture sintético)
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
    <div>
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
