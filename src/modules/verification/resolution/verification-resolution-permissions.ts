export const RESOLUTION_PERMISSIONS = [
  'verification.resolve',
  'verification.re_evaluate',
  'verification.view_resolution',
] as const

export type ResolutionPermission = (typeof RESOLUTION_PERMISSIONS)[number]

export const ALL_RESOLUTION_PERMISSIONS: ResolutionPermission[] = [...RESOLUTION_PERMISSIONS]

export function assertResolutionPermission(
  permissions: ResolutionPermission[],
  action: string,
): void {
  const map: Record<string, ResolutionPermission> = {
    resolve: 'verification.resolve',
    re_evaluate: 'verification.re_evaluate',
    view: 'verification.view_resolution',
  }
  const required = map[action]
  if (!required) throw new Error(`Acción de resolución desconocida: ${action}`)
  if (!permissions.includes(required)) {
    throw new Error(`Permiso requerido: ${required}`)
  }
}
