import type { IncomingMessage, ServerResponse } from 'node:http'
import { readJsonBody } from '../http/body.js'
import { rejectInvalidUuid } from '../http/route-utils.js'
import { jsonError, jsonResponse } from '../http/json.js'
import {
  assertMissionTaskBelongsToMission,
  assertVerificationNeedInMissionContext,
} from '../auth/payload-tenant-guard.js'
import {
  authorizeEvidenceMissionWrite,
  authorizeEvidenceSubmissionRead,
  authorizeEvidenceSubmissionWrite,
  authorizeIncidentAccess,
  authorizeMissionAccess,
  authorizeSignedUploadUrl,
  authorizeTaskEvidenceRead,
} from '../services/authorization/index.js'
import { runOperationalGuard } from '../middleware/operational-guard.js'
import {
  addStructuredObservation,
  confirmEvidenceUpload,
  createEvidenceSubmission,
  getEvidenceSubmissionDetail,
  getIncidentEvidence,
  getMissionEvidenceBundle,
  getMissionEvidenceCoverage,
  getTaskEvidence,
  issueEvidenceUploadUrl,
  withdrawEvidenceSubmission,
} from '../services/evidence-intake.service.js'

export async function handleEvidenceIntakeRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> {
  const missionEvidenceMatch = pathname.match(
    /^\/api\/operations\/missions\/([^/]+)\/evidence(?:-coverage|-submissions)?$/,
  )
  const createSubmissionMatch = pathname.match(
    /^\/api\/operations\/missions\/([^/]+)\/evidence-submissions$/,
  )
  const submissionMatch = pathname.match(/^\/api\/operations\/evidence-submissions\/([^/]+)(?:\/(.+))?$/)
  const taskEvidenceMatch = pathname.match(/^\/api\/operations\/tasks\/([^/]+)\/evidence$/)
  const incidentEvidenceMatch = pathname.match(/^\/api\/intelligence\/incidents\/([^/]+)\/evidence$/)

  const isEvidenceRoute =
    missionEvidenceMatch ||
    createSubmissionMatch ||
    submissionMatch ||
    taskEvidenceMatch ||
    incidentEvidenceMatch

  if (!isEvidenceRoute) return false

  try {
    if (createSubmissionMatch && req.method === 'POST') {
      const missionId = createSubmissionMatch[1]
      if (rejectInvalidUuid(req, res, missionId, 'ID de misión')) return true
      const body = await readJsonBody<Record<string, unknown>>(req)
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'evidence.submit',
          rateLimit: 'evidence_create',
          authorize: (auth) => authorizeEvidenceMissionWrite(auth, missionId),
        },
        async (auth) => {
          await assertMissionTaskBelongsToMission(
            auth,
            missionId,
            body.mission_task_id ? String(body.mission_task_id) : null,
          )
          await assertVerificationNeedInMissionContext(
            auth,
            missionId,
            body.verification_need_id ? String(body.verification_need_id) : null,
          )
          return createEvidenceSubmission(
            missionId,
            {
              mission_task_id: body.mission_task_id ? String(body.mission_task_id) : null,
              verification_need_id: body.verification_need_id ? String(body.verification_need_id) : null,
              source_type: body.source_type as never,
              evidence_type: body.evidence_type as never,
              description: body.description ? String(body.description) : undefined,
              captured_at: body.captured_at ? String(body.captured_at) : null,
              device_timestamp: body.device_timestamp ? String(body.device_timestamp) : null,
              location: body.location as never,
              source_device: body.source_device ? String(body.source_device) : null,
              source_application: body.source_application ? String(body.source_application) : null,
              metadata: (body.metadata as Record<string, unknown>) ?? {},
              sensitivity_classification: body.sensitivity_classification as never,
              requirement_ids: body.requirement_ids as string[] | undefined,
              idempotency_key: body.idempotency_key ? String(body.idempotency_key) : null,
              actor_id: auth.userId,
              supersedes_submission_id: body.supersedes_submission_id
                ? String(body.supersedes_submission_id)
                : null,
              supersede_reason: body.supersede_reason ? String(body.supersede_reason) : null,
            },
            auth,
          )
        },
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (missionEvidenceMatch && req.method === 'GET') {
      const missionId = missionEvidenceMatch[1]
      if (rejectInvalidUuid(req, res, missionId, 'ID de misión')) return true
      if (pathname.endsWith('/evidence-coverage')) {
        const result = await runOperationalGuard(
          req,
          res,
          {
            permission: 'evidence.view',
            rateLimit: 'default_read',
            authorize: (auth) => authorizeMissionAccess(auth, missionId),
          },
          async () => getMissionEvidenceCoverage(missionId),
        )
        if (result === null) return true
        jsonResponse(req, res, result)
        return true
      }
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'evidence.view',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeMissionAccess(auth, missionId),
        },
        async () => getMissionEvidenceBundle(missionId),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (submissionMatch) {
      const submissionId = submissionMatch[1]
      const action = submissionMatch[2]
      if (rejectInvalidUuid(req, res, submissionId, 'ID de submission')) return true

      if (!action && req.method === 'GET') {
        const result = await runOperationalGuard(
          req,
          res,
          {
            permission: 'evidence.view',
            rateLimit: 'default_read',
            authorize: (auth) => authorizeEvidenceSubmissionRead(auth, submissionId),
          },
          async () => getEvidenceSubmissionDetail(submissionId),
        )
        if (result === null) return true
        if (!result) {
          jsonError(req, res, 'Submission no encontrada', 404)
          return true
        }
        jsonResponse(req, res, result)
        return true
      }

      if (action === 'upload-url' && req.method === 'POST') {
        const body = await readJsonBody<Record<string, unknown>>(req)
        const result = await runOperationalGuard(
          req,
          res,
          {
            permission: 'evidence.submit',
            rateLimit: 'signed_url',
            authorize: (auth) => authorizeSignedUploadUrl(auth, submissionId),
          },
          async (auth) =>
            issueEvidenceUploadUrl(submissionId, {
              original_filename: String(body.original_filename ?? 'file'),
              mime_type: String(body.mime_type ?? 'application/octet-stream'),
              actor_id: auth.userId,
            }),
        )
        if (result === null) return true
        jsonResponse(req, res, result)
        return true
      }

      if (action === 'confirm-upload' && req.method === 'POST') {
        const body = await readJsonBody<Record<string, unknown>>(req)
        const result = await runOperationalGuard(
          req,
          res,
          {
            permission: 'evidence.submit',
            rateLimit: 'upload_session',
            authorize: (auth) => authorizeEvidenceSubmissionWrite(auth, submissionId),
          },
          async (auth) =>
            confirmEvidenceUpload(submissionId, {
              storage_path: String(body.storage_path),
              original_filename: String(body.original_filename),
              mime_type: String(body.mime_type),
              size_bytes: Number(body.size_bytes),
              checksum_sha256: body.checksum_sha256 ? String(body.checksum_sha256) : null,
              captured_at: body.captured_at ? String(body.captured_at) : null,
              width: body.width != null ? Number(body.width) : null,
              height: body.height != null ? Number(body.height) : null,
              duration_seconds: body.duration_seconds != null ? Number(body.duration_seconds) : null,
              embedded_metadata: (body.embedded_metadata as Record<string, unknown>) ?? {},
              idempotency_key: body.idempotency_key ? String(body.idempotency_key) : null,
              actor_id: auth.userId,
            }),
        )
        if (result === null) return true
        jsonResponse(req, res, result)
        return true
      }

      if (action === 'observations' && req.method === 'POST') {
        const body = await readJsonBody<Record<string, unknown>>(req)
        const result = await runOperationalGuard(
          req,
          res,
          {
            permission: 'evidence.submit',
            rateLimit: 'evidence_create',
            authorize: (auth) => authorizeEvidenceSubmissionWrite(auth, submissionId),
          },
          async (auth) =>
            addStructuredObservation(submissionId, {
              fields: (body.fields as Record<string, unknown>) ?? {},
              actor_id: auth.userId,
            }),
        )
        if (result === null) return true
        jsonResponse(req, res, result)
        return true
      }

      if (action === 'withdraw' && req.method === 'POST') {
        const body = await readJsonBody<Record<string, unknown>>(req)
        const result = await runOperationalGuard(
          req,
          res,
          {
            permission: 'evidence.withdraw',
            authorize: (auth) =>
              authorizeEvidenceSubmissionWrite(auth, submissionId, 'evidence.withdraw'),
          },
          async (auth) =>
            withdrawEvidenceSubmission(submissionId, {
              reason: String(body.reason ?? ''),
              actor_id: auth.userId,
              idempotency_key: body.idempotency_key ? String(body.idempotency_key) : null,
            }),
        )
        if (result === null) return true
        jsonResponse(req, res, result)
        return true
      }
    }

    if (taskEvidenceMatch && req.method === 'GET') {
      const taskId = taskEvidenceMatch[1]
      if (rejectInvalidUuid(req, res, taskId, 'ID de tarea')) return true
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'evidence.view',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeTaskEvidenceRead(auth, taskId),
        },
        async () => getTaskEvidence(taskId),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (incidentEvidenceMatch && req.method === 'GET') {
      const incidentId = incidentEvidenceMatch[1]
      if (rejectInvalidUuid(req, res, incidentId, 'ID de incidente')) return true
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'evidence.view',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeIncidentAccess(auth, incidentId),
        },
        async () => getIncidentEvidence(incidentId),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    jsonError(req, res, 'Method not allowed', 405)
    return true
  } catch (err) {
    jsonError(req, res, err instanceof Error ? err.message : 'Error interno', 400)
    return true
  }
}
