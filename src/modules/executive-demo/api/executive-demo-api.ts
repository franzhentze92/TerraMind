import type {
  ExecutiveDashboardDto,
  IncidentStoryDto,
  IncidentReportDto,
  NationalReportDto,
} from '@/modules/executive-demo/types/executive-demo.types'
import { authFetch } from '@/core/auth/auth-fetch'

const base = '/api'

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(`${base}${path}`, init)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export async function fetchExecutiveDashboard(
  includeDemo = false,
  periodHours = 48,
): Promise<ExecutiveDashboardDto> {
  const params = new URLSearchParams()
  if (includeDemo) params.set('include_demo', 'true')
  if (periodHours > 0) params.set('period_hours', String(periodHours))
  const q = params.toString() ? `?${params.toString()}` : ''
  return fetchJson(`/situacion/executive-dashboard${q}`)
}

export async function fetchIncidentStory(
  incidentId: string,
  includeDemo = false,
): Promise<IncidentStoryDto> {
  const q = includeDemo ? '?include_demo=true' : ''
  return fetchJson(`/intelligence/incidents/${incidentId}/story${q}`)
}

export async function fetchNationalReport(
  period = '7d',
  includeDemo = false,
): Promise<NationalReportDto> {
  const params = new URLSearchParams({ period })
  if (includeDemo) params.set('include_demo', 'true')
  return fetchJson(`/reports/national?${params}`)
}

export async function fetchIncidentReport(
  incidentId: string,
  includeDemo = false,
): Promise<IncidentReportDto> {
  const q = includeDemo ? '?include_demo=true' : ''
  return fetchJson(`/reports/incidents/${incidentId}${q}`)
}

export function nationalReportPdfUrl(period = '7d', includeDemo = false): string {
  const params = new URLSearchParams({ period, format: 'pdf' })
  if (includeDemo) params.set('include_demo', 'true')
  return `${base}/reports/national?${params}`
}

export function incidentReportPdfUrl(incidentId: string, includeDemo = false): string {
  const params = new URLSearchParams({ format: 'pdf' })
  if (includeDemo) params.set('include_demo', 'true')
  return `${base}/reports/incidents/${incidentId}?${params}`
}
