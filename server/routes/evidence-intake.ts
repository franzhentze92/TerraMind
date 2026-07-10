import type { IncomingMessage, ServerResponse } from 'node:http'
import { rejectIfUnauthenticated } from '../middleware/auth.js'
import { readJsonBody } from '../http/body.js'
import { jsonError, jsonResponse } from '../http/json.js'
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
  if (rejectIfUnauthenticated(req, res)) return true

  try {
    if (createSubmissionMatch && req.method === 'POST') {
      const missionId = createSubmissionMatch[1]
      if (!UUID_RE.test(missionId)) {
        jsonError(req, res, 'ID de misión inválido', 400)
        return true
      }
      const body = await readJsonBody<Record<string, unknown>>(req)
      const result = await createEvidenceSubmission(missionId, {
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
        actor_id: body.actor_id ? String(body.actor_id) : null,
        supersedes_submission_id: body.supersedes_submission_id
          ? String(body.supersedes_submission_id)
          : null,
        supersede_reason: body.supersede_reason ? String(body.supersede_reason) : null,
      })
      jsonResponse(req, res, result)
      return true
    }

    if (missionEvidenceMatch && req.method === 'GET') {
      const missionId = missionEvidenceMatch[1]
      if (!UUID_RE.test(missionId)) {
        jsonError(req, res, 'ID de misión inválido', 400)
        return true
      }
      if (pathname.endsWith('/evidence-coverage')) {
        jsonResponse(req, res, await getMissionEvidenceCoverage(missionId))
        return true
      }
      jsonResponse(req, res, await getMissionEvidenceBundle(missionId))
      return true
    }

    if (submissionMatch) {
      const submissionId = submissionMatch[1]
      const action = submissionMatch[2]
      if (!UUID_RE.test(submissionId)) {
        jsonError(req, res, 'ID de submission inválido', 400)
        return true
      }

      if (!action && req.method === 'GET') {
        const detail = await getEvidenceSubmissionDetail(submissionId)
        if (!detail) {
          jsonError(req, res, 'Submission no encontrada', 404)
          return true
        }
        jsonResponse(req, res, detail)
        return true
      }

      if (action === 'upload-url' && req.method === 'POST') {
        const body = await readJsonBody<Record<string, unknown>>(req)
        jsonResponse(
          req,
          res,
          await issueEvidenceUploadUrl(submissionId, {
            original_filename: String(body.original_filename ?? 'file'),
            mime_type: String(body.mime_type ?? 'application/octet-stream'),
            actor_id: body.actor_id ? String(body.actor_id) : null,
          }),
        )
        return true
      }

      if (action === 'confirm-upload' && req.method === 'POST') {
        const body = await readJsonBody<Record<string, unknown>>(req)
        jsonResponse(
          req,
          res,
          await confirmEvidenceUpload(submissionId, {
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
            actor_id: body.actor_id ? String(body.actor_id) : null,
          }),
        )
        return true
      }

      if (action === 'observations' && req.method === 'POST') {
        const body = await readJsonBody<Record<string, unknown>>(req)
        jsonResponse(
          req,
          res,
          await addStructuredObservation(submissionId, {
            fields: (body.fields as Record<string, unknown>) ?? {},
            actor_id: body.actor_id ? String(body.actor_id) : null,
          }),
        )
        return true
      }

      if (action === 'withdraw' && req.method === 'POST') {
        const body = await readJsonBody<Record<string, unknown>>(req)
        jsonResponse(
          req,
          res,
          await withdrawEvidenceSubmission(submissionId, {
            reason: String(body.reason ?? ''),
            actor_id: body.actor_id ? String(body.actor_id) : null,
            idempotency_key: body.idempotency_key ? String(body.idempotency_key) : null,
          }),
        )
        return true
      }
    }

    if (taskEvidenceMatch && req.method === 'GET') {
      const taskId = taskEvidenceMatch[1]
      if (!UUID_RE.test(taskId)) {
        jsonError(req, res, 'ID de tarea inválido', 400)
        return true
      }
      jsonResponse(req, res, await getTaskEvidence(taskId))
      return true
    }

    if (incidentEvidenceMatch && req.method === 'GET') {
      const incidentId = incidentEvidenceMatch[1]
      if (!UUID_RE.test(incidentId)) {
        jsonError(req, res, 'ID de incidente inválido', 400)
        return true
      }
      jsonResponse(req, res, await getIncidentEvidence(incidentId))
      return true
    }

    jsonError(req, res, 'Method not allowed', 405)
    return true
  } catch (err) {
    jsonError(req, res, err instanceof Error ? err.message : 'Error interno', 400)
    return true
  }
}
