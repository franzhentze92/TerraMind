import type { SyncTransport } from '@/modules/field-operations/field-sync/api/field-sync-transport'
import { authFetch } from '@/core/auth/auth-fetch'

const API = '/api/operations'

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await authFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `API error ${res.status}`)
  }
  return res.json() as Promise<T>
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await authFetch(path)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json() as Promise<T>
}

export function createHttpSyncTransport(): SyncTransport {
  return {
    async registerBundle(input) {
      const result = await apiPost<{
        registration_id: string
        idempotent_replay: boolean
      }>(`${API}/field-sync/bundles/register`, input)
      return result
    },

    async createSubmission(missionId, payload) {
      const result = await apiPost<{
        submission: { id: string; status: string }
        idempotent_replay: boolean
      }>(`${API}/missions/${missionId}/evidence-submissions`, {
        ...payload,
        source_type: 'mission_user',
        source_application: 'terramind-field-sync',
      })
      return {
        submission_id: String(result.submission.id),
        idempotent_replay: result.idempotent_replay,
        status: String(result.submission.status),
      }
    },

    async startUploadSession(submissionId, input) {
      return apiPost(`${API}/evidence-submissions/${submissionId}/upload-sessions`, input)
    },

    async renewUploadUrl(submissionId, uploadSessionId) {
      return apiPost(`${API}/evidence-submissions/${submissionId}/upload-sessions/${uploadSessionId}/renew-url`, {})
    },

    async getUploadSessionStatus(submissionId, uploadSessionId) {
      return apiGet(`${API}/evidence-submissions/${submissionId}/upload-sessions/${uploadSessionId}`)
    },

    async putUploadBytes(uploadUrl, chunk, offset, total) {
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        body: new Blob([chunk as BlobPart]),
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Range': `bytes ${offset}-${offset + chunk.byteLength - 1}/${total}`,
        },
      })
      if (!res.ok) throw new Error(`upload_failed_${res.status}`)
      return { bytes_written: chunk.byteLength }
    },

    async confirmUpload(submissionId, input) {
      const result = await apiPost<{ asset: { id: string }; idempotent_replay: boolean }>(
        `${API}/evidence-submissions/${submissionId}/confirm-upload`,
        input,
      )
      return { asset_id: String(result.asset.id), idempotent_replay: result.idempotent_replay }
    },

    async addObservation(submissionId, input) {
      await apiPost(`${API}/evidence-submissions/${submissionId}/observations`, {
        fields: input.fields,
      })
      return { idempotent_replay: false }
    },

    async linkRequirements(submissionId, input) {
      const result = await apiPost<{ linked_count: number }>(
        `${API}/evidence-submissions/${submissionId}/requirement-links`,
        { links: input.links },
      )
      return result
    },

    async finalizeSubmission(submissionId, input) {
      return apiPost(`${API}/evidence-submissions/${submissionId}/finalize-intake`, input)
    },

    async getSubmissionReconciliation(submissionId) {
      return apiGet(`${API}/evidence-submissions/${submissionId}/reconciliation`)
    },

    async getMissionStatus(missionId) {
      const mission = await apiGet<{ status: string }>(`${API}/missions/${missionId}`)
      return { status: mission.status, cancelled: mission.status === 'cancelled' }
    },

    async getPackageRemoteStatus(_packageId) {
      return { revoked: false, superseded: false }
    },
  }
}
