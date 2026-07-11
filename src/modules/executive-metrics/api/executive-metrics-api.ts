import { authFetch } from '@/core/auth/auth-fetch'
import type {
  DataQualitySummary,
  ExecutiveMetric,
  ExecutiveMetricsResponse,
} from '@/modules/executive-metrics/executive-metric.types'
import type { MetricScope } from '@/modules/executive-metrics/metric-taxonomy'

const base = '/api'

async function fetchJson<T>(path: string): Promise<T> {
  const res = await authFetch(`${base}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export interface ExecutiveMetricsQuery {
  scope?: MetricScope
  includeDemo?: boolean
  includeLegacy?: boolean
}

function toQueryString(query: ExecutiveMetricsQuery): string {
  const params = new URLSearchParams()
  if (query.scope) params.set('scope', query.scope)
  if (query.includeDemo) params.set('include_demo', 'true')
  if (query.includeLegacy === false) params.set('include_legacy', 'false')
  const s = params.toString()
  return s ? `?${s}` : ''
}

export async function fetchExecutiveMetrics(
  query: ExecutiveMetricsQuery = {},
): Promise<ExecutiveMetricsResponse> {
  return fetchJson(`/executive/metrics${toQueryString(query)}`)
}

export async function fetchExecutiveMetric(
  metricId: string,
  query: ExecutiveMetricsQuery = {},
): Promise<ExecutiveMetric> {
  return fetchJson(`/executive/metrics/${encodeURIComponent(metricId)}${toQueryString(query)}`)
}

export async function fetchDataQualitySummary(): Promise<DataQualitySummary> {
  return fetchJson('/executive/data-quality-summary')
}
