import type { IncomingMessage, ServerResponse } from 'node:http'
import { rejectIfUnauthenticated, requireRequestAuth } from '../middleware/auth.js'
import { readJsonBody } from '../http/body.js'
import { jsonError, jsonResponse } from '../http/json.js'
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function handleFieldSyncRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> {
  const bundleRegisterMatch = pathname.match(/^\/api\/operations\/field-sync\/bundles\/register$/)
  const submissionMatch = pathname.match(/^\/api\/operations\/evidence-submissions\/([^/]+)(?:\/(.+))?$/)
  if (!bundleRegisterMatch && !submissionMatch) return false
  if (await rejectIfUnauthenticated(req, res)) return true

  try {
    if (bundleRegisterMatch && req.method === 'POST') {
      const body = await readJsonBody<Record<string, unknown>>(req)
      const auth = requireRequestAuth(req)
      jsonResponse(
        req,
        res,
        await registerBundleSync(auth, {
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
      return true
    }

    if (submissionMatch) {
      const submissionId = submissionMatch[1]
      const action = submissionMatch[2]
      if (!UUID_RE.test(submissionId)) {
        jsonError(req, res, 'ID de submission inválido', 400)
        return true
      }

      if (action === 'upload-sessions' && req.method === 'POST') {
        const body = await readJsonBody<Record<string, unknown>>(req)
        jsonResponse(
          req,
          res,
          await startEvidenceUploadSession(submissionId, {
            local_asset_id: body.local_asset_id ? String(body.local_asset_id) : null,
            mime_type: String(body.mime_type ?? 'application/octet-stream'),
            original_filename: String(body.original_filename ?? 'file'),
            expected_size_bytes: Number(body.expected_size_bytes ?? 0),
            expected_checksum_sha256: body.expected_checksum_sha256
              ? String(body.expected_checksum_sha256)
              : null,
            idempotency_key: String(body.idempotency_key),
            actor_id: body.actor_id ? String(body.actor_id) : null,
          }),
        )
        return true
      }

      const uploadSessionMatch = action?.match(/^upload-sessions\/([^/]+)(?:\/(.+))?$/)
      if (uploadSessionMatch) {
        const uploadSessionId = uploadSessionMatch[1]
        const subAction = uploadSessionMatch[2]

        if (subAction === 'renew-url' && req.method === 'POST') {
          jsonResponse(req, res, await renewEvidenceUploadUrl(submissionId, uploadSessionId))
          return true
        }

        if (subAction === 'progress' && req.method === 'POST') {
          const body = await readJsonBody<Record<string, unknown>>(req)
          jsonResponse(
            req,
            res,
            await reportUploadProgress(submissionId, uploadSessionId, {
              bytes_transferred: Number(body.bytes_transferred ?? 0),
              status: body.status ? String(body.status) : undefined,
            }),
          )
          return true
        }

        if (!subAction && req.method === 'GET') {
          jsonResponse(req, res, await getUploadSessionStatus(submissionId, uploadSessionId))
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
        jsonResponse(req, res, await linkSubmissionRequirements(submissionId, links))
        return true
      }

      if (action === 'finalize-intake' && req.method === 'POST') {
        const body = await readJsonBody<Record<string, unknown>>(req)
        jsonResponse(
          req,
          res,
          await finalizeSubmissionIntake(
            submissionId,
            body.actor_id ? String(body.actor_id) : null,
          ),
        )
        return true
      }

      if (action === 'reconciliation' && req.method === 'GET') {
        jsonResponse(req, res, await getSubmissionReconciliation(submissionId))
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
