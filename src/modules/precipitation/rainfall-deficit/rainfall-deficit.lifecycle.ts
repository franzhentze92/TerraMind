/**
 * Rainfall deficit — lifecycle mapping (canonical framework states).
 */
import type { EnvironmentalLifecycleState } from '@/modules/environmental-events/types/taxonomy'
import { LIFECYCLE_GRACE_UPDATES } from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.config'

export interface LifecycleInput {
  previous?: EnvironmentalLifecycleState
  consecutiveActiveUpdates: number
  consecutiveRecoveryUpdates: number
  consecutiveInactiveUpdates: number
  areaDeltaPercent?: number
  intensityDelta?: number
  stillMeetsCriteria: boolean
}

export function resolveLifecycle(input: LifecycleInput): EnvironmentalLifecycleState {
  if (!input.stillMeetsCriteria) {
    if (input.consecutiveInactiveUpdates >= LIFECYCLE_GRACE_UPDATES) return 'ended'
    return input.previous === 'declining' ? 'declining' : 'declining'
  }
  if (input.consecutiveActiveUpdates <= 2) return 'emerging'
  if (input.consecutiveRecoveryUpdates >= 2) return 'declining'
  if ((input.areaDeltaPercent ?? 0) > 15) return 'expanding'
  if (input.consecutiveActiveUpdates >= 4) return 'persistent'
  return input.previous ?? 'persistent'
}

export const LIFECYCLE_LABELS: Record<EnvironmentalLifecycleState, string> = {
  emerging: 'En formación',
  expanding: 'En expansión',
  persistent: 'Persistente',
  declining: 'En recuperación',
  ended: 'Finalizado',
}
