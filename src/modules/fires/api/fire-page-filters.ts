import {
  FIRE_DEFAULT_PERIOD,
  FIRE_EVENTS_DEFAULT_LIMIT,
  FIRE_PERIOD_PRESETS,
  type FirePeriodPreset,
} from '@/modules/fires/config/fire.constants'
import type { FireEventsQuery } from '@/modules/fires/api/fire-api.validation'
import { computeWindowBounds } from '@/modules/fires/api/fire-api.validation'

export interface FirePageFilters {
  period: FirePeriodPreset
  department_code?: string
  risk_level?: string
  status?: string
  validation_status?: string
  source_product?: string
  min_priority?: number
  page: number
}

export const DEFAULT_FIRE_PAGE_FILTERS: FirePageFilters = {
  period: FIRE_DEFAULT_PERIOD,
  page: 1,
}

export function parsePageFilters(searchParams: URLSearchParams): FirePageFilters {
  const period = (searchParams.get('period') as FirePeriodPreset) || FIRE_DEFAULT_PERIOD
  const validPeriod = period in FIRE_PERIOD_PRESETS ? period : FIRE_DEFAULT_PERIOD
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1)
  const minPriorityRaw = searchParams.get('min_priority')
  const minPriority =
    minPriorityRaw !== null && minPriorityRaw !== ''
      ? Number(minPriorityRaw)
      : undefined

  const filters: FirePageFilters = { period: validPeriod, page }

  const department = searchParams.get('department_code')
  if (department) filters.department_code = department

  const risk = searchParams.get('risk_level')
  if (risk) filters.risk_level = risk

  const status = searchParams.get('status')
  if (status) filters.status = status

  const validation = searchParams.get('validation_status')
  if (validation) filters.validation_status = validation

  const source = searchParams.get('source_product')
  if (source) filters.source_product = source

  if (minPriority !== undefined && Number.isFinite(minPriority)) {
    filters.min_priority = minPriority
  }

  return filters
}

export function pageFiltersToSearchParams(filters: FirePageFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.period !== FIRE_DEFAULT_PERIOD) params.set('period', filters.period)
  if (filters.department_code) params.set('department_code', filters.department_code)
  if (filters.risk_level) params.set('risk_level', filters.risk_level)
  if (filters.status) params.set('status', filters.status)
  if (filters.validation_status) params.set('validation_status', filters.validation_status)
  if (filters.source_product) params.set('source_product', filters.source_product)
  if (filters.min_priority !== undefined) {
    params.set('min_priority', String(filters.min_priority))
  }
  if (filters.page > 1) params.set('page', String(filters.page))
  return params
}

export function pageFiltersToApiQuery(
  filters: FirePageFilters,
  now: Date = new Date(),
): Record<string, string | number> {
  const hours = FIRE_PERIOD_PRESETS[filters.period]
  const { window_start_utc } = computeWindowBounds(hours, now)
  const query: Record<string, string | number> = {
    since: window_start_utc,
    limit: FIRE_EVENTS_DEFAULT_LIMIT,
    offset: (filters.page - 1) * FIRE_EVENTS_DEFAULT_LIMIT,
  }

  if (filters.department_code) query.department_code = filters.department_code
  if (filters.risk_level) query.risk_level = filters.risk_level
  if (filters.status) query.status = filters.status
  if (filters.validation_status) query.validation_status = filters.validation_status
  if (filters.source_product) query.source_product = filters.source_product
  if (filters.min_priority !== undefined) query.min_priority = filters.min_priority

  return query
}

export function filtersToApiQueryShape(filters: FirePageFilters): Partial<FireEventsQuery> {
  const api = pageFiltersToApiQuery(filters)
  return {
    since: api.since as string,
    limit: api.limit as number,
    offset: api.offset as number,
    department_code: api.department_code as string | undefined,
    risk_level: api.risk_level as FireEventsQuery['risk_level'],
    status: api.status as FireEventsQuery['status'],
    validation_status: api.validation_status as FireEventsQuery['validation_status'],
    source_product: api.source_product as FireEventsQuery['source_product'],
    min_priority: api.min_priority as number | undefined,
  }
}

export function countActiveFilters(filters: FirePageFilters): number {
  let n = 0
  if (filters.department_code) n++
  if (filters.risk_level) n++
  if (filters.status) n++
  if (filters.validation_status) n++
  if (filters.source_product) n++
  if (filters.min_priority !== undefined) n++
  return n
}

export function buildIncendiosPath(
  filters: FirePageFilters,
  eventId?: string | null,
): string {
  const params = pageFiltersToSearchParams(filters)
  const qs = params.toString()
  const base = eventId ? `/incendios/${eventId}` : '/incendios'
  return qs ? `${base}?${qs}` : base
}
