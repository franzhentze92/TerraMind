import type { IncomingMessage, ServerResponse } from 'node:http'
import { rejectInvalidUuid } from '../http/route-utils.js'
import { jsonError, jsonResponse } from '../http/json.js'
import { runOperationalGuard } from '../middleware/operational-guard.js'
import {
  buildIncidentReport,
  buildNationalReport,
  parseReportPeriod,
} from '../services/reports.service.js'
import {
  renderIncidentReportPdf,
  renderNationalReportPdf,
} from '../services/reports-pdf.service.js'
import { authorizeIncidentStoryAccess } from '../services/incident-story.service.js'

export async function handleReportsRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  searchParams: URLSearchParams,
): Promise<boolean> {
  if (!pathname.startsWith('/api/reports')) return false
  if (req.method !== 'GET') {
    jsonError(req, res, 'Method not allowed', 405)
    return true
  }

  const includeDemo = searchParams.get('include_demo') === 'true'
  const period = parseReportPeriod(
    searchParams.get('period'),
    searchParams.get('from'),
    searchParams.get('to'),
  )
  const format = searchParams.get('format') ?? 'json'

  if (pathname === '/api/reports/national') {
    const result = await runOperationalGuard(
      req,
      res,
      { permission: 'findings.view', rateLimit: 'default_read', auditType: 'report_national' },
      async (auth) => buildNationalReport(auth, period, includeDemo),
    )
    if (result === null) return true
    if (format === 'pdf') {
      const pdf = await renderNationalReportPdf(result)
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="terramind-national-report.pdf"',
      })
      res.end(pdf)
      return true
    }
    jsonResponse(req, res, result)
    return true
  }

  const incidentMatch = pathname.match(/^\/api\/reports\/incidents\/([^/]+)$/)
  if (incidentMatch) {
    const incidentId = incidentMatch[1]
    if (rejectInvalidUuid(req, res, incidentId, 'ID de incidente')) return true
    const result = await runOperationalGuard(
      req,
      res,
      {
        permission: 'incidents.view',
        rateLimit: 'default_read',
        auditType: 'report_incident',
        resourceId: incidentId,
        authorize: async (auth) => {
          await authorizeIncidentStoryAccess(auth, incidentId, includeDemo)
          return {
            ...auth,
            resourceType: 'incident',
            resourceId: incidentId,
            organizationId: auth.activeOrganizationId,
            authorizedAt: new Date().toISOString(),
          }
        },
      },
      async (auth) => buildIncidentReport(auth, incidentId, includeDemo),
    )
    if (result === null) return true
    if (!result) {
      jsonError(req, res, 'Informe no encontrado', 404)
      return true
    }
    if (format === 'pdf') {
      const pdf = await renderIncidentReportPdf(result)
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="terramind-incident-${incidentId.slice(0, 8)}.pdf"`,
      })
      res.end(pdf)
      return true
    }
    jsonResponse(req, res, result)
    return true
  }

  jsonError(req, res, 'Not found', 404)
  return true
}
