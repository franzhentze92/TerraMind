import type { IncomingMessage, ServerResponse } from 'node:http'
import { readJsonBody } from '../http/body.js'
import { rejectInvalidUuid } from '../http/route-utils.js'
import { jsonError, jsonResponse } from '../http/json.js'
import {
  authorizeEvidenceSubmissionRead,
  authorizeEvidenceSubmissionWrite,
  authorizeFieldSyncAccess,
  authorizeSignedUploadUrl,
} from '../services/authorization/index.js'
import { runOperationalGuard } from '../middleware/operational-guard.js'
import {
  finalizeSubmissionIntake,
  getSubmissionReconciliation,
  getUploadSessionStatus,
  linkSubmissionRequirements,
  registerBundleSync,
  renewEvidenceUploadUrl,
  reportUploadProgress,
  startEvidenceUploadSession,
} from '../services/field-sync.service.js'
import { loadRealSyncPilotPolicy } from '../auth/real-sync-pilot-policy.js'
import { sanitizePilotPolicyForClient } from '@/core/field-sync/real-sync-pilot-policy.js'
import { rejectIfUnauthenticated } from '../middleware/auth.js'
import { requireRequestAuth } from '../middleware/auth.js'

export async function handleFieldSyncRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> {
  if (pathname === '/api/operations/field-sync/pilot-policy' && req.method === 'GET') {
    if (await rejectIfUnauthenticated(req, res)) return true
    const auth = requireRequestAuth(req)
    const policy = loadRealSyncPilotPolicy()
    const clientPolicy = sanitizePilotPolicyForClient(policy)
    const missionAllowed = clientPolicy.allowedMissionIds.includes(
      String(req.headers['x-terramind-mission-id'] ?? ''),
    )
    jsonResponse(req, res, {
      ...clientPolicy,
      globalRealSyncEnabled: false,
      currentUserAllowlisted:
        policy.enabled &&
        (policy.allowedUserIds.includes(auth.authUserId) ||
          policy.allowedUserIds.includes(auth.userId)),
      currentMissionAllowlisted: missionAllowed,
      message: clientPolicy.pilotActive
        ? 'Piloto interno — sync real habilitado solo para misiones allowlisted'
        : 'Sync real bloqueado — piloto no activo',
    })
    return true
  }

  const bundleRegisterMatch = pathname.match(/^\/api\/operations\/field-sync\/bundles\/register$/)
  const submissionMatch = pathname.match(/^\/api\/operations\/evidence-submissions\/([^/]+)(?:\/(.+))?$/)
  if (!bundleRegisterMatch && !submissionMatch) return false

  try {
    if (bundleRegisterMatch && req.method === 'POST') {
      const body = await readJsonBody<Record<string, unknown>>(req)
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'field_sync.execute',
          rateLimit: 'field_sync_register',
          authorize: (auth) =>
            authorizeFieldSyncAccess(auth, {
              mission_id: String(body.mission_id),
              package_id: body.package_id ? String(body.package_id) : null,
              bundle_id: String(body.bundle_id),
            }),
        },
        async (auth) =>
          registerBundleSync(auth, {
            bundle_id: String(body.bundle_id),
            bundle_checksum: String(body.bundle_checksum),
            mission_id: String(body.mission_id),
            package_id: body.package_id ? String(body.package_id) : null,
            package_version: body.package_version != null ? Number(body.package_version) : null,
            task_id: body.task_id ? String(body.task_id) : null,
            idempotency_key: String(body.idempotency_key),
            metadata: (body.metadata as Record<string, unknown>) ?? {},
          }),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (submissionMatch) {
      const submissionId = submissionMatch[1]
      const action = submissionMatch[2]
      if (rejectInvalidUuid(req, res, submissionId, 'ID de submission')) return true

      if (action === 'upload-sessions' && req.method === 'POST') {
        const body = await readJsonBody<Record<string, unknown>>(req)
        const result = await runOperationalGuard(
          req,
          res,
          {
            permission: 'evidence.submit',
            rateLimit: 'upload_session',
            authorize: (auth) => authorizeSignedUploadUrl(auth, submissionId),
          },
          async (auth) =>
            startEvidenceUploadSession(auth, submissionId, {
              local_asset_id: body.local_asset_id ? String(body.local_asset_id) : null,
              mime_type: String(body.mime_type ?? 'application/octet-stream'),
              original_filename: String(body.original_filename ?? 'file'),
              expected_size_bytes: Number(body.expected_size_bytes ?? 0),
              expected_checksum_sha256: body.expected_checksum_sha256
                ? String(body.expected_checksum_sha256)
                : null,
              idempotency_key: String(body.idempotency_key),
              actor_id: auth.userId,
            }),
        )
        if (result === null) return true
        jsonResponse(req, res, result)
        return true
      }

      const uploadSessionMatch = action?.match(/^upload-sessions\/([^/]+)(?:\/(.+))?$/)
      if (uploadSessionMatch) {
        const uploadSessionId = uploadSessionMatch[1]
        const subAction = uploadSessionMatch[2]

        if (subAction === 'renew-url' && req.method === 'POST') {
          const result = await runOperationalGuard(
            req,
            res,
            {
              permission: 'evidence.submit',
              rateLimit: 'signed_url',
              authorize: (auth) => authorizeSignedUploadUrl(auth, submissionId),
            },
            async (auth) => renewEvidenceUploadUrl(auth, submissionId, uploadSessionId),
          )
          if (result === null) return true
          jsonResponse(req, res, result)
          return true
        }

        if (subAction === 'progress' && req.method === 'POST') {
          const body = await readJsonBody<Record<string, unknown>>(req)
          const result = await runOperationalGuard(
            req,
            res,
            {
              permission: 'evidence.submit',
              rateLimit: 'sync_retry',
              authorize: (auth) => authorizeEvidenceSubmissionWrite(auth, submissionId),
            },
            async (auth) =>
              reportUploadProgress(auth, submissionId, uploadSessionId, {
                bytes_transferred: Number(body.bytes_transferred ?? 0),
                status: body.status ? String(body.status) : undefined,
              }),
          )
          if (result === null) return true
          jsonResponse(req, res, result)
          return true
        }

        if (!subAction && req.method === 'GET') {
          const result = await runOperationalGuard(
            req,
            res,
            {
              permission: 'evidence.view',
              rateLimit: 'default_read',
              authorize: (auth) => authorizeEvidenceSubmissionRead(auth, submissionId),
            },
            async (auth) => getUploadSessionStatus(auth, submissionId, uploadSessionId),
          )
          if (result === null) return true
          jsonResponse(req, res, result)
          return true
        }
      }

      if (action === 'requirement-links' && req.method === 'POST') {
        const body = await readJsonBody<Record<string, unknown>>(req)
        const links = ((body.links as Array<Record<string, unknown>>) ?? []).map((l) => ({
          requirement_id: String(l.requirement_id),
          match_type: String(l.match_type),
          match_score: Number(l.match_score ?? 0),
          match_reason: String(l.match_reason ?? ''),
          preliminary_coverage: String(l.preliminary_coverage ?? 'partial'),
        }))
        const result = await runOperationalGuard(
          req,
          res,
          {
            permission: 'evidence.submit',
            authorize: (auth) => authorizeEvidenceSubmissionWrite(auth, submissionId),
          },
          async (auth) => linkSubmissionRequirements(auth, submissionId, links),
        )
        if (result === null) return true
        jsonResponse(req, res, result)
        return true
      }

      if (action === 'finalize-intake' && req.method === 'POST') {
        const result = await runOperationalGuard(
          req,
          res,
          {
            permission: 'evidence.submit',
            authorize: (auth) => authorizeEvidenceSubmissionWrite(auth, submissionId),
          },
          async (auth) => finalizeSubmissionIntake(auth, submissionId, auth.userId),
        )
        if (result === null) return true
        jsonResponse(req, res, result)
        return true
      }

      if (action === 'reconciliation' && req.method === 'GET') {
        const result = await runOperationalGuard(
          req,
          res,
          {
            permission: 'evidence.view',
            rateLimit: 'default_read',
            authorize: (auth) => authorizeEvidenceSubmissionRead(auth, submissionId),
          },
          async (auth) => getSubmissionReconciliation(auth, submissionId),
        )
        if (result === null) return true
        jsonResponse(req, res, result)
        return true
      }
    }

    jsonError(req, res, 'Method not allowed', 405)
    return true
  } catch (err) {
    jsonError(req, res, err instanceof Error ? err.message : 'Error interno', 400)
    return true
  }
}
