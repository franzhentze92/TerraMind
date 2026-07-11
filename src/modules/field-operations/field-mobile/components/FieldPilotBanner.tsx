import { FIELD_REAL_SYNC_ENABLED } from '@/modules/field-operations/field-mobile/config/fire-field-mobile.config'

interface FieldPilotBannerProps {
  pilotActive: boolean
  missionId?: string | null
  missionSyncEnabled?: boolean
}

export function FieldPilotBanner({ pilotActive, missionId, missionSyncEnabled }: FieldPilotBannerProps) {
  if (FIELD_REAL_SYNC_ENABLED) return null

  if (pilotActive && missionSyncEnabled && missionId) {
    return (
      <div className="rounded-lg border border-accent/40 bg-accent/5 px-3 py-2 text-xs text-accent">
        <p className="font-medium">Modo de demostración</p>
        <p className="mt-0.5 text-text-secondary">
          Sincronización habilitada para la misión activa en esta cuenta.
        </p>
      </div>
    )
  }

  if (pilotActive) {
    return (
      <div className="rounded-lg border border-border-subtle bg-surface-2/40 px-3 py-2 text-xs text-text-secondary">
        Demostración interna activa — la sincronización real solo aplica a misiones habilitadas.
      </div>
    )
  }

  return (
    <p className="text-xs text-confidence-medium">
      Sincronización no habilitada para esta cuenta. El trabajo se guarda en este dispositivo.
    </p>
  )
}
