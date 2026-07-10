import { loadFireFindingEvaluationContext } from '@/modules/findings/services/fire-finding-context.loader'
import { mapFindingRowToDto } from '@/pipeline/stores/composite-findings.store'
import { listActiveFindingsForEntity } from '@/pipeline/stores/composite-findings.store'
import {
  FIRE_PRIORITY_FINDINGS_RULE_SET,
  FIRE_PRIORITY_MODEL_VERSION,
} from '@/modules/priorities/config/fire-priority.config'
import type { FirePriorityEventContext } from '@/modules/priorities/priorities.types'
import type { ContextAvailability } from '@/modules/findings/services/fire-finding-context.loader'

export async function loadFirePriorityEvaluationContext(
  eventId: string,
): Promise<FirePriorityEventContext | null> {
  const ctx = await loadFireFindingEvaluationContext(eventId)
  if (!ctx) return null

  const { getSupabaseAdmin } = await import('@/pipeline/stores/supabase.client')
  const supabase = getSupabaseAdmin()
  const { data: eventMeta } = await supabase
    .from('fire_events')
    .select('persistence_hours')
    .eq('id', eventId)
    .maybeSingle()

  const mapAvail = (v: ContextAvailability): FirePriorityEventContext['context_availability']['protected_area'] => {
    if (v === 'unavailable') return 'unavailable'
    if (v === 'partial') return 'partial'
    if (v === 'complete') return 'complete'
    return 'missing'
  }

  return {
    id: ctx.event.id,
    department_code: ctx.event.department_code,
    department_name: ctx.event.department_name,
    status: ctx.event.status,
    validation_status: ctx.event.validation_status,
    detection_count: ctx.event.detection_count,
    first_detected_at: ctx.event.first_detected_at,
    last_detected_at: ctx.event.last_detected_at,
    persistence_hours:
      eventMeta?.persistence_hours != null ? Number(eventMeta.persistence_hours) : null,
    context_availability: {
      protected_area: mapAvail(ctx.availability.protected_area),
      land_cover: mapAvail(ctx.availability.land_cover),
      population: mapAvail(ctx.availability.population),
      climate: mapAvail(ctx.availability.climate),
      biodiversity: mapAvail(ctx.availability.biodiversity),
    },
    context_version: ctx.context_versions.composite,
    rule_set_version: ctx.context_versions.rule_set,
  }
}

export async function loadActiveFindingsForPriority(eventId: string) {
  const rows = await listActiveFindingsForEntity(
    'fire_event',
    eventId,
    FIRE_PRIORITY_FINDINGS_RULE_SET,
  )
  return rows.map(mapFindingRowToDto)
}

export function resolvePriorityModelVersion(): string {
  return FIRE_PRIORITY_MODEL_VERSION
}

export function resolvePriorityFindingsRuleSet(): string {
  return FIRE_PRIORITY_FINDINGS_RULE_SET
}
