import type { IncomingMessage, ServerResponse } from 'node:http'
import { rejectIfUnauthenticated } from '../middleware/auth.js'
import { readJsonBody } from '../http/body.js'
import { jsonError, jsonResponse } from '../http/json.js'
import {
  confirmOfflinePackageDownload,
  createOfflinePackageDownloadUrl,
  generateOfflinePackageForMission,
  getOfflinePackageDetail,
  getOfflinePackageManifest,
  getOfflinePackageStatus,
  listMissionOfflinePackages,
  revokeOfflinePackageById,
  validateOfflinePackageIntegrity,
} from '../services/offline-packages.service.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function handleOfflinePackageRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> {
  const missionPackagesMatch = pathname.match(
    /^\/api\/operations\/missions\/([^/]+)\/offline-packages$/,
  )
  const packageDetailMatch = pathname.match(/^\/api\/operations\/offline-packages\/([^/]+)$/)
  const downloadUrlMatch = pathname.match(
    /^\/api\/operations\/offline-packages\/([^/]+)\/download-url$/,
  )
  const confirmDownloadMatch = pathname.match(
    /^\/api\/operations\/offline-packages\/([^/]+)\/confirm-download$/,
  )
  const revokeMatch = pathname.match(/^\/api\/operations\/offline-packages\/([^/]+)\/revoke$/)
  const manifestMatch = pathname.match(/^\/api\/operations\/offline-packages\/([^/]+)\/manifest$/)
  const statusMatch = pathname.match(/^\/api\/operations\/offline-packages\/([^/]+)\/status$/)
  const validateMatch = pathname.match(/^\/api\/operations\/offline-packages\/([^/]+)\/validate$/)

  const isRoute =
    missionPackagesMatch ||
    packageDetailMatch ||
    downloadUrlMatch ||
    confirmDownloadMatch ||
    revokeMatch ||
    manifestMatch ||
    statusMatch ||
    validateMatch
  if (!isRoute) return false
  if (rejectIfUnauthenticated(req, res)) return true

  try {
    if (missionPackagesMatch) {
      const missionId = missionPackagesMatch[1]
      if (!UUID_RE.test(missionId)) {
        jsonError(req, res, 'ID de misión inválido', 400)
        return true
      }
      if (req.method === 'GET') {
        jsonResponse(req, res, await listMissionOfflinePackages(missionId))
        return true
      }
      if (req.method === 'POST') {
        const body = await readJsonBody<Record<string, unknown>>(req)
        if (!body.idempotency_key) {
          jsonError(req, res, 'idempotency_key es requerido', 400)
          return true
        }
        const result = await generateOfflinePackageForMission(missionId, {
          actor_id: body.actor_id ? String(body.actor_id) : null,
          idempotency_key: String(body.idempotency_key),
          allow_historical: Boolean(body.allow_historical),
        })
        if (!result) {
          jsonError(req, res, 'Misión no encontrada', 404)
          return true
        }
        jsonResponse(req, res, result, result.decision === 'not_eligible' ? 422 : 201)
        return true
      }
    }

    const extractId = (match: RegExpMatchArray | null) => match?.[1] ?? ''
    const packageId =
      extractId(packageDetailMatch) ||
      extractId(downloadUrlMatch) ||
      extractId(confirmDownloadMatch) ||
      extractId(revokeMatch) ||
      extractId(manifestMatch) ||
      extractId(statusMatch) ||
      extractId(validateMatch)

    if (!UUID_RE.test(packageId)) {
      jsonError(req, res, 'ID de paquete inválido', 400)
      return true
    }

    if (packageDetailMatch && req.method === 'GET') {
      const detail = await getOfflinePackageDetail(packageId)
      if (!detail) {
        jsonError(req, res, 'Paquete no encontrado', 404)
        return true
      }
      jsonResponse(req, res, detail)
      return true
    }

    if (manifestMatch && req.method === 'GET') {
      const manifest = await getOfflinePackageManifest(packageId)
      if (!manifest) {
        jsonError(req, res, 'Paquete no encontrado', 404)
        return true
      }
      jsonResponse(req, res, manifest)
      return true
    }

    if (statusMatch && req.method === 'GET') {
      const status = await getOfflinePackageStatus(packageId)
      if (!status) {
        jsonError(req, res, 'Paquete no encontrado', 404)
        return true
      }
      jsonResponse(req, res, status)
      return true
    }

    if (validateMatch && req.method === 'GET') {
      const validation = await validateOfflinePackageIntegrity(packageId)
      if (!validation) {
        jsonError(req, res, 'Paquete no encontrado', 404)
        return true
      }
      jsonResponse(req, res, validation)
      return true
    }

    if (downloadUrlMatch && req.method === 'POST') {
      const body = await readJsonBody<Record<string, unknown>>(req)
      try {
        const payload = await createOfflinePackageDownloadUrl(packageId, {
          user_id: body.user_id ? String(body.user_id) : null,
          device_pseudonym: body.device_pseudonym ? String(body.device_pseudonym) : null,
          app_version: body.app_version ? String(body.app_version) : null,
          idempotency_key: body.idempotency_key ? String(body.idempotency_key) : null,
        })
        if (!payload) {
          jsonError(req, res, 'Paquete no encontrado', 404)
          return true
        }
        jsonResponse(req, res, payload)
      } catch (err) {
        jsonError(req, res, err instanceof Error ? err.message : 'download_unavailable', 409)
      }
      return true
    }

    if (confirmDownloadMatch && req.method === 'POST') {
      const body = await readJsonBody<Record<string, unknown>>(req)
      if (!body.idempotency_key) {
        jsonError(req, res, 'idempotency_key es requerido', 400)
        return true
      }
      const result = await confirmOfflinePackageDownload(packageId, {
        user_id: body.user_id ? String(body.user_id) : null,
        team_id: body.team_id ? String(body.team_id) : null,
        device_pseudonym: body.device_pseudonym ? String(body.device_pseudonym) : null,
        app_version: body.app_version ? String(body.app_version) : null,
        idempotency_key: String(body.idempotency_key),
        checksum_verified: body.checksum_verified === undefined ? undefined : Boolean(body.checksum_verified),
      })
      if (!result) {
        jsonError(req, res, 'Paquete no encontrado', 404)
        return true
      }
      jsonResponse(req, res, result)
      return true
    }

    if (revokeMatch && req.method === 'POST') {
      const body = await readJsonBody<Record<string, unknown>>(req)
      if (!body.reason) {
        jsonError(req, res, 'reason es requerido', 400)
        return true
      }
      const result = await revokeOfflinePackageById(packageId, {
        reason: String(body.reason),
        actor_id: body.actor_id ? String(body.actor_id) : null,
      })
      if (!result) {
        jsonError(req, res, 'Paquete no encontrado', 404)
        return true
      }
      jsonResponse(req, res, result)
      return true
    }

    jsonError(req, res, 'Método no permitido', 405)
    return true
  } catch (err) {
    jsonError(req, res, err instanceof Error ? err.message : 'offline_package_error', 500)
    return true
  }
}
