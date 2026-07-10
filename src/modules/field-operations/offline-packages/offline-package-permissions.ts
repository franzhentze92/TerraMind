import { ACTION_REQUIRED_PERMISSION } from '@/modules/field-operations/offline-packages/config/fire-offline-package.config'
import type { OfflinePackagePermission } from '@/modules/field-operations/offline-packages/offline-package.types'

export const ALL_OFFLINE_PACKAGE_PERMISSIONS: OfflinePackagePermission[] = [
  'offline_packages.generate',
  'offline_packages.download',
  'offline_packages.view',
  'offline_packages.revoke',
  'offline_packages.view_sensitive',
  'offline_packages.download_historical',
]

export function hasOfflinePackagePermission(
  permissions: OfflinePackagePermission[],
  required: OfflinePackagePermission,
): boolean {
  return permissions.includes(required)
}

export function assertOfflinePackagePermission(
  permissions: OfflinePackagePermission[],
  action: string,
): void {
  const required = ACTION_REQUIRED_PERMISSION[action]
  if (!required) throw new Error(`Acción desconocida: ${action}`)
  if (!hasOfflinePackagePermission(permissions, required)) {
    throw new Error(`Permiso requerido: ${required}`)
  }
}
