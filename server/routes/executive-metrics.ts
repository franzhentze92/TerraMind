import type { IncomingMessage, ServerResponse } from 'node:http'
import { jsonResponse, jsonError } from '../http/json.js'
import { runOperationalGuard } from '../middleware/operational-guard.js'
import {
  getDataQualitySummary,
  getExecutiveMetric,
  getExecutiveMetrics,
  type ExecutiveMetricsOptions,
} from '../services/executive-metrics.service.js'
import { isMetricScope, type MetricScope } from '@/modules/executive-metrics/metric-taxonomy'

function parseOptions(searchParams: URLSearchParams): ExecutiveMetricsOptions {
  return {
    include_demo: searchParams.get('include_demo') === 'true',
    include_legacy: searchParams.get('include_legacy') !== 'false',
  }
}

function parseScope(searchParams: URLSearchParams): MetricScope | undefined {
  const raw = searchParams.get('scope')
  return raw && isMetricScope(raw) ? raw : undefined
}

export async function handleExecutiveMetricsRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  searchParams: URLSearchParams,
): Promise<boolean> {
  if (!pathname.startsWith('/api/executive/')) return false
  if (req.method !== 'GET') {
    jsonResponse(req, res, { error: 'Method not allowed' }, 405)
    return true
  }

  const options = parseOptions(searchParams)
  const scope = parseScope(searchParams)

  if (pathname === '/api/executive/metrics') {
    const result = await runOperationalGuard(
      req,
      res,
      { permission: 'findings.view', rateLimit: 'default_read', auditType: 'executive_metrics' },
      async (auth) => {
        const metrics = await getExecutiveMetrics(auth, options)
        const filtered = scope ? metrics.filter((m) => m.scope === scope) : metrics
        return {
          generated_at: new Date().toISOString(),
          scope: scope ?? 'national',
          include_demo: options.include_demo === true,
          include_legacy: options.include_legacy !== false,
          metrics: filtered,
        }
      },
    )
    if (result === null) return true
    jsonResponse(req, res, result)
    return true
  }

  if (pathname === '/api/executive/data-quality-summary') {
    const result = await runOperationalGuard(
      req,
      res,
      { permission: 'findings.view', rateLimit: 'default_read', auditType: 'executive_data_quality' },
      async (auth) => getDataQualitySummary(auth),
    )
    if (result === null) return true
    jsonResponse(req, res, result)
    return true
  }

  const detailMatch = pathname.match(/^\/api\/executive\/metrics\/([^/]+)$/)
  if (detailMatch) {
    const metricId = decodeURIComponent(detailMatch[1])
    const result = await runOperationalGuard(
      req,
      res,
      { permission: 'findings.view', rateLimit: 'default_read', auditType: 'executive_metric_detail' },
      async (auth) => getExecutiveMetric(auth, metricId, options),
    )
    if (result === null) return true
    if (!result) {
      jsonError(req, res, 'Métrica no encontrada', 404)
      return true
    }
    jsonResponse(req, res, result)
    return true
  }

  jsonResponse(req, res, { error: 'Not found' }, 404)
  return true
}
