import type { EvidencePermission } from '@/modules/evidence/evidence-intake.types'
import { ACTION_REQUIRED_PERMISSION } from '@/modules/evidence/config/fire-evidence-intake.config'

export function hasEvidencePermission(
  permissions: EvidencePermission[],
  required: EvidencePermission,
): boolean {
  return permissions.includes(required)
}

export function assertEvidencePermission(
  permissions: EvidencePermission[],
  action: string,
): void {
  const required = ACTION_REQUIRED_PERMISSION[action]
  if (!required) throw new Error(`Acción de evidencia desconocida: ${action}`)
  if (!hasEvidencePermission(permissions, required)) {
    throw new Error(`Permiso requerido: ${required}`)
  }
}
