import type { TerramindPermission } from '@/core/auth/permissions'
import { AuthorizationError } from '@/core/auth/permissions'

const WORKFLOW_PERMISSION: Record<string, TerramindPermission> = {
  assign: 'missions.assign',
  accept: 'missions.accept',
  decline: 'missions.decline',
  start: 'missions.start',
  block: 'missions.block',
  resume: 'missions.start',
  reassign: 'missions.assign',
  complete: 'missions.complete',
  cancel: 'missions.cancel',
}

export function permissionForWorkflowAction(action: string): TerramindPermission {
  const perm = WORKFLOW_PERMISSION[action]
  if (!perm) throw new AuthorizationError(`Acción de workflow desconocida: ${action}`, 400)
  return perm
}
