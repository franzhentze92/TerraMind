/**
 * Environmental Event Framework — frontend API client.
 *
 * Talks to the generic read API. Thermal keeps its own `/incendios` experience;
 * this client is the extension point for future types and for Situación Nacional
 * type summaries.
 */
import { apiClient } from '@/core/api/client'
import type {
  EnvironmentalEvent,
  EnvironmentalEventPage,
  EnvironmentalEventQuery,
  EnvironmentalEventTypeSummary,
} from '@/modules/environmental-events/types/environmental-event.types'

function toQueryString(query?: EnvironmentalEventQuery): string {
  if (!query) return ''
  const search = new URLSearchParams()
  const set = (k: string, v: string | number | undefined) => {
    if (v !== undefined && v !== '') search.set(k, String(v))
  }
  set('type', query.type)
  set('status', query.status)
  set('lifecycle', query.lifecycle)
  set('classification', query.classification)
  set('since', query.since)
  set('until', query.until)
  set('department_code', query.departmentCode)
  set('page', query.page)
  set('limit', query.limit)
  if (query.bounds) set('bounds', query.bounds.join(','))
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

export interface EnvironmentalEventTypesResponse {
  items: EnvironmentalEventTypeSummary[]
  generated_at: string
}

export const environmentalEventsApi = {
  list: (query?: EnvironmentalEventQuery) =>
    apiClient.get<EnvironmentalEventPage>(
      `/environmental-events${toQueryString(query)}`,
    ),

  getById: (id: string) =>
    apiClient.get<EnvironmentalEvent>(`/environmental-events/${id}`),

  types: (windowHours?: number) =>
    apiClient.get<EnvironmentalEventTypesResponse>(
      `/environmental-events/types${
        windowHours && windowHours > 0 ? `?window_hours=${windowHours}` : ''
      }`,
    ),
}
