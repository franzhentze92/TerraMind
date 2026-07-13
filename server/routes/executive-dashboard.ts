import type { IncomingMessage, ServerResponse } from 'node:http'
import { jsonResponse } from '../http/json.js'
import { runOperationalGuard } from '../middleware/operational-guard.js'
import { getExecutiveDashboard, getDataAuditReport } from '../services/executive-dashboard.service.js'

export async function handleExecutiveDashboardRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  searchParams: URLSearchParams,
): Promise<boolean> {
  if (!pathname.startsWith('/api/situacion/executive')) return false
  if (req.method !== 'GET') {
    jsonResponse(req, res, { error: 'Method not allowed' }, 405)
    return true
  }

  const includeDemo = searchParams.get('include_demo') === 'true'
  const periodHours = Number.parseInt(searchParams.get('period_hours') ?? '48', 10)

  if (pathname === '/api/situacion/executive-dashboard') {
    const result = await runOperationalGuard(
      req,
      res,
      { permission: 'findings.view', rateLimit: 'default_read', auditType: 'executive_dashboard' },
      async (auth) =>
        getExecutiveDashboard(auth, {
          include_demo: includeDemo,
          period_hours: Number.isFinite(periodHours) && periodHours > 0 ? periodHours : 48,
        }),
    )
    if (result === null) return true
    jsonResponse(req, res, result)
    return true
  }

  if (pathname === '/api/situacion/data-audit') {
    const result = await runOperationalGuard(
      req,
      res,
      { permission: 'findings.view', rateLimit: 'default_read', auditType: 'data_audit' },
      async () => getDataAuditReport(),
    )
    if (result === null) return true
    jsonResponse(req, res, result)
    return true
  }

  jsonResponse(req, res, { error: 'Not found' }, 404)
  return true
}
