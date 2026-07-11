import type { IncomingMessage, ServerResponse } from 'node:http'
import { rejectInvalidUuid } from '../http/route-utils.js'
import { jsonError, jsonResponse } from '../http/json.js'
import { runOperationalGuard } from '../middleware/operational-guard.js'
import {
  authorizeIncidentStoryAccess,
  getIncidentStory,
} from '../services/incident-story.service.js'

export async function handleIncidentStoryRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  searchParams: URLSearchParams,
): Promise<boolean> {
  const storyMatch = pathname.match(/^\/api\/intelligence\/incidents\/([^/]+)\/story$/)
  if (!storyMatch || req.method !== 'GET') return false

  const incidentId = storyMatch[1]
  if (rejectInvalidUuid(req, res, incidentId, 'ID de incidente')) return true
  const includeDemo = searchParams.get('include_demo') === 'true'

  const result = await runOperationalGuard(
    req,
    res,
    {
      permission: 'incidents.view',
      rateLimit: 'default_read',
      auditType: 'incident_story',
      resourceType: 'incident',
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
    async () => getIncidentStory(incidentId, { include_demo: includeDemo }),
  )
  if (result === null) return true
  if (!result) {
    jsonError(req, res, 'Historia no encontrada', 404)
    return true
  }
  jsonResponse(req, res, result)
  return true
}
