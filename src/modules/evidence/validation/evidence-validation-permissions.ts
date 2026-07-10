import type { ValidationPermission } from '@/modules/evidence/validation/evidence-validation.types'
import { VALIDATION_ACTION_PERMISSION } from '@/modules/evidence/config/fire-evidence-validation.config'

export function assertValidationPermission(
  permissions: ValidationPermission[],
  action: string,
): void {
  const required = VALIDATION_ACTION_PERMISSION[action]
  if (!required) throw new Error(`Acción de validación desconocida: ${action}`)
  if (!permissions.includes(required)) {
    throw new Error(`Permiso requerido: ${required}`)
  }
}
