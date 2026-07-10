import type { MissionStatus } from '@/modules/missions/missions.types'

const VALID_TRANSITIONS: Record<MissionStatus, MissionStatus[]> = {
  draft: ['ready', 'cancelled'],
  ready: ['approved', 'cancelled', 'expired', 'in_progress'],
  approved: ['in_progress', 'cancelled', 'expired'],
  in_progress: ['completed', 'inconclusive', 'blocked', 'failed'],
  blocked: ['in_progress', 'cancelled', 'expired'],
  completed: [],
  inconclusive: [],
  cancelled: [],
  expired: [],
  failed: [],
}

export function isValidMissionTransition(
  from: MissionStatus,
  to: MissionStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export function assertValidMissionTransition(
  from: MissionStatus,
  to: MissionStatus,
): void {
  if (!isValidMissionTransition(from, to)) {
    throw new Error(`Transición de misión inválida: ${from} → ${to}`)
  }
}

export function canCompleteMission(input: {
  status: MissionStatus
  requiredTasksPending: number
  explicitInconclusive: boolean
}): { allowed: boolean; reason: string } {
  if (input.status !== 'in_progress' && input.status !== 'blocked') {
    return { allowed: false, reason: 'La misión no está en progreso' }
  }
  if (input.requiredTasksPending > 0 && !input.explicitInconclusive) {
    return {
      allowed: false,
      reason: 'Tareas obligatorias pendientes; use resultado inconcluso con razón explícita',
    }
  }
  return { allowed: true, reason: 'Completitud permitida' }
}
