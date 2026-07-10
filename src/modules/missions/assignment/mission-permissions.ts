import type { MissionPermission } from '@/modules/missions/assignment/assignment.types'
import { ACTION_REQUIRED_PERMISSION } from '@/modules/missions/config/fire-assignment.config'

export function hasMissionPermission(
  permissions: MissionPermission[],
  required: MissionPermission,
): boolean {
  return permissions.includes(required)
}

export function assertMissionPermission(
  permissions: MissionPermission[],
  action: string,
  overrideCompatibility = false,
): void {
  const required = ACTION_REQUIRED_PERMISSION[action]
  if (!required) throw new Error(`Acción desconocida: ${action}`)
  if (!hasMissionPermission(permissions, required)) {
    throw new Error(`Permiso requerido: ${required}`)
  }
  if (overrideCompatibility && !hasMissionPermission(permissions, 'missions.override_compatibility')) {
    throw new Error('Permiso requerido: missions.override_compatibility')
  }
}
