/**
 * Environmental Event Framework — thermal query mapper (pure).
 *
 * Translates a canonical EnvironmentalEventQuery into the existing thermal
 * FireEventsQuery. Pure and side-effect free so it can be unit-tested without
 * loading any server/database code.
 */
import type { FireEventsQuery } from '@/modules/fires/api/fire-api.validation'
import type { FireEventStatus } from '@/modules/fires/types/fire.dto'
import type { EnvironmentalEventQuery } from '@/modules/environmental-events/types/environmental-event.types'
import type { EnvironmentalEventStatus } from '@/modules/environmental-events/types/taxonomy'

export const CANONICAL_TO_FIRE_STATUS: Record<
  EnvironmentalEventStatus,
  FireEventStatus | undefined
> = {
  detected: 'new',
  active: 'active',
  monitoring: 'monitoring',
  resolved: 'closed',
  archived: undefined,
}

export function toFireEventsQuery(query: EnvironmentalEventQuery): FireEventsQuery {
  const limit = query.limit && query.limit > 0 ? query.limit : 25
  const page = query.page && query.page > 0 ? query.page : 1
  const status = query.status ? CANONICAL_TO_FIRE_STATUS[query.status] : undefined
  return {
    since: query.since,
    until: query.until,
    department_code: query.departmentCode,
    status,
    limit,
    offset: (page - 1) * limit,
  } as FireEventsQuery
}
