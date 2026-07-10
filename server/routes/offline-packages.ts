import type { IncomingMessage, ServerResponse } from 'node:http'
import { AuthorizationError } from '@/core/auth/permissions'
import { readJsonBody } from '../http/body.js'
import { rejectInvalidUuid } from '../http/route-utils.js'
import { jsonError, jsonResponse } from '../http/json.js'
import {
  authorizeOfflinePackageAccess,
  authorizeOfflinePackageMissionAction,
} from '../services/authorization/index.js'
import { runOperationalGuard } from '../middleware/operational-guard.js'
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

  try {
    if (missionPackagesMatch) {
      const missionId = missionPackagesMatch[1]
      if (rejectInvalidUuid(req, res, missionId, 'ID de misión')) return true
      if (req.method === 'GET') {
        const result = await runOperationalGuard(
          req,
          res,
          {
            permission: 'offline_packages.download',
            rateLimit: 'default_read',
            authorize: (auth) => authorizeOfflinePackageMissionAction(auth, missionId, 'list'),
          },
          async () => listMissionOfflinePackages(missionId),
        )
        if (result === null) return true
        jsonResponse(req, res, result)
        return true
      }
      if (req.method === 'POST') {
        const body = await readJsonBody<Record<string, unknown>>(req)
        if (!body.idempotency_key) {
          jsonError(req, res, 'idempotency_key es requerido', 400)
          return true
        }
        const result = await runOperationalGuard(
          req,
          res,
          {
            permission: 'offline_packages.generate',
            rateLimit: 'package_generate',
            authorize: (auth) => authorizeOfflinePackageMissionAction(auth, missionId, 'generate'),
          },
          async (auth) =>
            generateOfflinePackageForMission(missionId, {
              actor_id: auth.userId,
              idempotency_key: String(body.idempotency_key),
              allow_historical: Boolean(body.allow_historical),
            }),
        )
        if (result === null) return true
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

    if (!packageId || rejectInvalidUuid(req, res, packageId, 'ID de paquete')) return true

    if (packageDetailMatch && req.method === 'GET') {
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'offline_packages.download',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeOfflinePackageAccess(auth, packageId, 'read'),
        },
        async () => getOfflinePackageDetail(packageId),
      )
      if (result === null) return true
      if (!result) {
        jsonError(req, res, 'Paquete no encontrado', 404)
        return true
      }
      jsonResponse(req, res, result)
      return true
    }

    if (manifestMatch && req.method === 'GET') {
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'offline_packages.download',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeOfflinePackageAccess(auth, packageId, 'read'),
        },
        async () => getOfflinePackageManifest(packageId),
      )
      if (result === null) return true
      if (!result) {
        jsonError(req, res, 'Paquete no encontrado', 404)
        return true
      }
      jsonResponse(req, res, result)
      return true
    }

    if (statusMatch && req.method === 'GET') {
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'offline_packages.download',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeOfflinePackageAccess(auth, packageId, 'read'),
        },
        async () => getOfflinePackageStatus(packageId),
      )
      if (result === null) return true
      if (!result) {
        jsonError(req, res, 'Paquete no encontrado', 404)
        return true
      }
      jsonResponse(req, res, result)
      return true
    }

    if (validateMatch && req.method === 'GET') {
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'offline_packages.download',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeOfflinePackageAccess(auth, packageId, 'read'),
        },
        async () => validateOfflinePackageIntegrity(packageId),
      )
      if (result === null) return true
      if (!result) {
        jsonError(req, res, 'Paquete no encontrado', 404)
        return true
      }
      jsonResponse(req, res, result)
      return true
    }

    if (downloadUrlMatch && req.method === 'POST') {
      const body = await readJsonBody<Record<string, unknown>>(req)
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'offline_packages.download',
          rateLimit: 'package_download',
          authorize: (auth) => authorizeOfflinePackageAccess(auth, packageId, 'download'),
        },
        async () => {
          try {
            return await createOfflinePackageDownloadUrl(packageId, {
              user_id: body.user_id ? String(body.user_id) : null,
              device_pseudonym: body.device_pseudonym ? String(body.device_pseudonym) : null,
              app_version: body.app_version ? String(body.app_version) : null,
              idempotency_key: body.idempotency_key ? String(body.idempotency_key) : null,
            })
          } catch (err) {
            throw new AuthorizationError(
              err instanceof Error ? err.message : 'download_unavailable',
              409,
            )
          }
        },
      )
      if (result === null) return true
      if (!result) {
        jsonError(req, res, 'Paquete no encontrado', 404)
        return true
      }
      jsonResponse(req, res, result)
      return true
    }

    if (confirmDownloadMatch && req.method === 'POST') {
      const body = await readJsonBody<Record<string, unknown>>(req)
      if (!body.idempotency_key) {
        jsonError(req, res, 'idempotency_key es requerido', 400)
        return true
      }
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'offline_packages.download',
          rateLimit: 'package_download',
          authorize: (auth) => authorizeOfflinePackageAccess(auth, packageId, 'download'),
        },
        async () =>
          confirmOfflinePackageDownload(packageId, {
            user_id: body.user_id ? String(body.user_id) : null,
            team_id: body.team_id ? String(body.team_id) : null,
            device_pseudonym: body.device_pseudonym ? String(body.device_pseudonym) : null,
            app_version: body.app_version ? String(body.app_version) : null,
            idempotency_key: String(body.idempotency_key),
            checksum_verified:
              body.checksum_verified === undefined ? undefined : Boolean(body.checksum_verified),
          }),
      )
      if (result === null) return true
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
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'offline_packages.revoke',
          authorize: (auth) => authorizeOfflinePackageAccess(auth, packageId, 'revoke'),
        },
        async (auth) =>
          revokeOfflinePackageById(packageId, {
            reason: String(body.reason),
            actor_id: auth.userId,
          }),
      )
      if (result === null) return true
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
