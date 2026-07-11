import { FIELD_REAL_SYNC_ENABLED } from '@/modules/field-operations/field-mobile/config/fire-field-mobile.config'

interface FieldPilotBannerProps {
  pilotActive: boolean
  missionId?: string | null
  missionAllowlisted?: boolean
}

export function FieldPilotBanner({ pilotActive, missionId, missionAllowlisted }: FieldPilotBannerProps) {
  if (FIELD_REAL_SYNC_ENABLED) return null

  if (pilotActive && missionAllowlisted && missionId) {
    return (
      <div className="rounded-lg border border-accent/40 bg-accent/5 px-3 py-2 text-xs text-accent">
        <p className="font-medium">Piloto interno</p>
        <p className="mt-0.5 text-text-secondary">
          Sync real habilitado solo para esta misión ({missionId.slice(0, 8)}…).
        </p>
      </div>
    )
  }

  if (pilotActive) {
    return (
      <div className="rounded-lg border border-border-subtle bg-surface-2/40 px-3 py-2 text-xs text-text-secondary">
        Piloto interno activo — sync real solo en misiones allowlisted.
      </div>
    )
  }

  return (
    <p className="text-xs text-confidence-medium">
      Sync simulado — producción global bloqueada. Piloto 8B.7G requiere allowlist explícita.
    </p>
  )
}
