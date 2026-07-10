import type { FireLifecycleState } from '@/modules/lifecycle/lifecycle.types'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

const FINDING_RULE_SET = '1.0.0'

export async function bulkUpdateFindingStatusForEntity(input: {
  entity_type: string
  entity_id: string
  from_statuses: string[]
  to_status: string
}): Promise<number> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('composite_findings')
    .update({ status: input.to_status, updated_at: now })
    .eq('entity_type', input.entity_type)
    .eq('entity_id', input.entity_id)
    .eq('rule_set_version', FINDING_RULE_SET)
    .in('status', input.from_statuses)
    .select('id')
  if (error) throw new Error(error.message)
  return (data ?? []).length
}

export async function syncFindingsWithLifecycleState(
  eventId: string,
  newState: FireLifecycleState,
): Promise<number> {
  switch (newState) {
    case 'inactive_monitoring':
    case 'declining':
      return bulkUpdateFindingStatusForEntity({
        entity_type: 'fire_event',
        entity_id: eventId,
        from_statuses: ['active'],
        to_status: 'monitoring',
      })
    case 'resolved':
      return bulkUpdateFindingStatusForEntity({
        entity_type: 'fire_event',
        entity_id: eventId,
        from_statuses: ['active', 'monitoring'],
        to_status: 'resolved',
      })
    case 'invalidated':
      return bulkUpdateFindingStatusForEntity({
        entity_type: 'fire_event',
        entity_id: eventId,
        from_statuses: ['active', 'monitoring'],
        to_status: 'dismissed',
      })
    default:
      return 0
  }
}

export function shouldEnqueueFindingReevaluation(state: FireLifecycleState): boolean {
  return [
    'active',
    'persistent',
    'expanding',
    'declining',
    'reactivated',
    'inactive_monitoring',
    'resolved',
    'invalidated',
  ].includes(state)
}

export function shouldEnqueuePriorityReevaluation(state: FireLifecycleState): boolean {
  return [
    'active',
    'persistent',
    'expanding',
    'declining',
    'inactive_monitoring',
    'resolved',
    'reactivated',
    'invalidated',
  ].includes(state)
}

export function shouldExpirePriorityQueue(state: FireLifecycleState): boolean {
  return state === 'resolved' || state === 'invalidated'
}
