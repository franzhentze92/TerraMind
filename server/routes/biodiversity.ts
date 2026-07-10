import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  parseBiodiversitySearchQuery,
  parseBiodiversityTaxonResolveQuery,
} from '@/modules/biodiversity/biodiversity.dto'
import { toInternalSearchQuery } from '@/modules/biodiversity/biodiversity.dto'
import { getBiodiversityService } from '@/modules/biodiversity/biodiversity.service'
import { rejectIfUnauthenticated } from '../middleware/auth.js'
import { jsonError, jsonResponse } from '../http/json.js'

/**
 * Rutas de biodiversidad preparadas pero NO montadas en server/index.ts
 * hasta revisar seguridad y rate limiting.
 */
export async function handleBiodiversityRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  searchParams: URLSearchParams,
): Promise<boolean> {
  if (!pathname.startsWith('/api/environment/biodiversity')) return false
  if (req.method !== 'GET') {
    jsonError(req, res, 'Method not allowed', 405)
    return true
  }
  if (rejectIfUnauthenticated(req, res)) return true

  const service = getBiodiversityService()

  try {
    if (pathname === '/api/environment/biodiversity/search') {
      const parsed = parseBiodiversitySearchQuery(searchParams)
      if (!parsed.ok) {
        jsonError(req, res, parsed.error, 400)
        return true
      }
      const result = await service.searchOccurrencesPublic(toInternalSearchQuery(parsed.data))
      jsonResponse(req, res, result)
      return true
    }

    if (pathname === '/api/environment/biodiversity/taxa/resolve') {
      const parsed = parseBiodiversityTaxonResolveQuery(searchParams)
      if (!parsed.ok) {
        jsonError(req, res, parsed.error, 400)
        return true
      }
      const taxon = await service.resolveTaxon({
        scientificName: parsed.data.name,
        taxonId: parsed.data.taxon_id,
        provider: parsed.data.provider,
      })
      jsonResponse(req, res, { taxon, generated_at: new Date().toISOString() })
      return true
    }

    if (pathname === '/api/environment/biodiversity/health') {
      const health = await service.getSystemHealth()
      jsonResponse(req, res, health)
      return true
    }

    jsonError(req, res, 'Not found', 404)
    return true
  } catch (err) {
    jsonError(req, res, err instanceof Error ? err.message : 'Error interno', 500)
    return true
  }
}
