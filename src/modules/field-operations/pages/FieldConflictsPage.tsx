import { OperationalEmptyState } from '@/shared/components'
import { useFieldConflicts } from '@/modules/field-operations/field-mobile/hooks/useFieldCampo'
import { t } from '@/modules/field-operations/field-mobile/i18n/field-mobile-i18n'

const CONFLICT_LABEL_KEYS: Record<string, string> = {
  mission_cancelled: 'mission_cancelled',
  package_revoked: 'package_revoked',
  package_superseded: 'package_superseded',
  permission_denied: 'permission_denied',
  session_expired: 'session_expired',
  checksum_mismatch: 'checksum_mismatch',
  bundle_modified: 'bundle_modified',
  network_interrupted: 'network_interrupted',
}

const CONFLICT_ACTIONS = [
  { key: 'keep_local', labelKey: 'keep_local' },
  { key: 'pause', labelKey: 'pause' },
  { key: 'retry', labelKey: 'retry' },
  { key: 'download_update', labelKey: 'download_update' },
  { key: 'create_revision', labelKey: 'create_revision' },
  { key: 'request_help', labelKey: 'request_help' },
]

export function FieldConflictsPage() {
  const { conflicts } = useFieldConflicts()

  return (
    <div className="mx-auto max-w-lg p-4" data-testid="field-conflicts-page">
      <h1 className="text-lg font-medium text-text-primary">Conflictos y bloqueos</h1>
      <p className="mt-1 text-sm text-text-secondary">{t('kept_locally_for_safety', 'es')}</p>

      {conflicts.length === 0 && (
        <OperationalEmptyState
          compact
          className="mt-4"
          title="No hay conflictos de sincronización"
          explanation="Los conflictos aparecerán aquí si una misión cambia, se revoca un paquete o existe una diferencia entre el dispositivo y el servidor."
          status="not_required"
        />
      )}

      <ul className="mt-4 space-y-3">
        {conflicts.map((c) => (
          <li key={c.conflict_id} className="rounded-lg border border-confidence-medium/40 bg-surface-2/30 p-4">
            <p className="text-sm font-medium text-text-primary">
              {t(CONFLICT_LABEL_KEYS[c.conflict_type] ?? 'needs_review', 'es')}
            </p>
            <p className="mt-1 text-xs text-text-secondary">{c.message}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {CONFLICT_ACTIONS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  className="rounded border border-border-subtle px-3 py-1.5 text-xs"
                >
                  {t(a.labelKey, 'es')}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
