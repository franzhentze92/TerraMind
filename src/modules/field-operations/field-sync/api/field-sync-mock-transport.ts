import type {
  CreateSubmissionPayload,
  SyncTransport,
} from '@/modules/field-operations/field-sync/api/field-sync-transport'
import type { RemoteSubmissionSnapshot } from '@/modules/field-operations/field-sync/engine/field-sync-reconciliation'

interface MockSubmission {
  id: string
  mission_id: string
  evidence_type: string
  status: string
  idempotency_key: string
  assets: Array<{ id: string; checksum_sha256: string; size_bytes: number }>
  observation: Record<string, unknown> | null
  links: Array<{ requirement_id: string }>
}

export interface MockSyncTransportOptions {
  mission_cancelled?: boolean
  package_revoked?: boolean
  permission_denied?: boolean
  fail_upload_at_byte?: number
  expire_url_once?: boolean
  checksum_mismatch_on_confirm?: boolean
  processing_status?: string
}

export function createMockSyncTransport(options: MockSyncTransportOptions = {}): SyncTransport {
  const submissions = new Map<string, MockSubmission>()
  const submissionByIdem = new Map<string, string>()
  const uploadSessions = new Map<
    string,
    { bytes: Uint8Array; expected_checksum: string; transferred: number; url_expired: boolean }
  >()
  const bundleRegistrations = new Set<string>()
  let urlRenewCount = 0

  return {
    async registerBundle(input) {
      if (options.package_revoked) throw new Error('package_revoked')
      const replay = bundleRegistrations.has(input.idempotency_key)
      if (!replay) bundleRegistrations.add(input.idempotency_key)
      return { registration_id: `reg-${input.bundle_id}`, idempotent_replay: replay }
    },

    async createSubmission(missionId, payload: CreateSubmissionPayload) {
      if (options.mission_cancelled) throw new Error('mission_cancelled')
      if (options.permission_denied) throw new Error('permission_denied')
      const existing = submissionByIdem.get(payload.idempotency_key)
      if (existing) {
        const sub = submissions.get(existing)!
        return { submission_id: sub.id, idempotent_replay: true, status: sub.status }
      }
      const id = `sub-${submissions.size + 1}`
      submissions.set(id, {
        id,
        mission_id: missionId,
        evidence_type: payload.evidence_type,
        status: 'received',
        idempotency_key: payload.idempotency_key,
        assets: [],
        observation: null,
        links: [],
      })
      submissionByIdem.set(payload.idempotency_key, id)
      return { submission_id: id, idempotent_replay: false, status: 'received' }
    },

    async startUploadSession(_submissionId, input) {
      uploadSessions.set(input.idempotency_key, {
        bytes: new Uint8Array(input.expected_size_bytes),
        expected_checksum: input.expected_checksum_sha256,
        transferred: 0,
        url_expired: Boolean(options.expire_url_once && urlRenewCount === 0),
      })
      return {
        upload_session_id: `up-${input.idempotency_key}`,
        upload_url: `mock://upload/${input.idempotency_key}`,
        storage_path: `mock/path/${input.idempotency_key}`,
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        idempotent_replay: false,
        bytes_transferred: 0,
      }
    },

    async renewUploadUrl(_submissionId, uploadSessionId) {
      urlRenewCount++
      return {
        upload_url: `mock://upload/renewed/${uploadSessionId}`,
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      }
    },

    async getUploadSessionStatus(_submissionId, _uploadSessionId) {
      return { status: 'uploading', bytes_transferred: 0 }
    },

    async putUploadBytes(uploadUrl, chunk, offset, _total) {
      const key = uploadUrl.replace('mock://upload/renewed/', '').replace('mock://upload/', '')
      const sessionKey = [...uploadSessions.keys()].find((k) => key.includes(k) || k.includes(key.split('/').pop()!))
      const session = sessionKey ? uploadSessions.get(sessionKey) : undefined
      if (session?.url_expired) {
        session.url_expired = false
        throw new Error('upload_url_expired')
      }
      if (options.fail_upload_at_byte != null && offset + chunk.byteLength >= options.fail_upload_at_byte) {
        throw new Error('network_interrupted')
      }
      if (session) {
        session.bytes.set(chunk, offset)
        session.transferred = offset + chunk.byteLength
      }
      return { bytes_written: chunk.byteLength }
    },

    async confirmUpload(submissionId, input) {
      const sub = submissions.get(submissionId)
      if (!sub) throw new Error('missing_submission')
      const existing = sub.assets.find((a) => a.checksum_sha256 === input.checksum_sha256)
      if (existing) return { asset_id: existing.id, idempotent_replay: true }
      if (options.checksum_mismatch_on_confirm) throw new Error('checksum_mismatch')
      const assetId = `asset-${sub.assets.length + 1}`
      sub.assets.push({
        id: assetId,
        checksum_sha256: input.checksum_sha256,
        size_bytes: input.size_bytes,
      })
      sub.status = 'processing'
      return { asset_id: assetId, idempotent_replay: false }
    },

    async addObservation(submissionId, input) {
      const sub = submissions.get(submissionId)
      if (!sub) throw new Error('missing_submission')
      if (!sub.observation) sub.observation = input.fields
      return { idempotent_replay: Boolean(sub.observation && sub.observation !== input.fields) }
    },

    async linkRequirements(submissionId, input) {
      const sub = submissions.get(submissionId)
      if (!sub) throw new Error('missing_submission')
      for (const link of input.links) {
        if (!sub.links.some((l) => l.requirement_id === link.requirement_id)) {
          sub.links.push({ requirement_id: link.requirement_id })
        }
      }
      return { linked_count: sub.links.length }
    },

    async finalizeSubmission(submissionId) {
      const sub = submissions.get(submissionId)
      if (!sub) throw new Error('missing_submission')
      sub.status = options.processing_status ?? 'ready_for_validation'
      return { status: sub.status }
    },

    async getSubmissionReconciliation(submissionId): Promise<RemoteSubmissionSnapshot> {
      const sub = submissions.get(submissionId)!
      return {
        submission_id: submissionId,
        status: sub?.status ?? 'received',
        evidence_type: sub?.evidence_type ?? 'structured_observation',
        assets: sub?.assets ?? [],
        has_observation: Boolean(sub?.observation),
        requirement_link_count: sub?.links.length ?? 0,
      }
    },

    async getMissionStatus(_missionId) {
      return { status: options.mission_cancelled ? 'cancelled' : 'in_progress', cancelled: Boolean(options.mission_cancelled) }
    },

    async getPackageRemoteStatus(_packageId) {
      return { revoked: Boolean(options.package_revoked), superseded: false }
    },

    _submissions: submissions,
  } as SyncTransport & { _submissions: Map<string, MockSubmission> }
}
