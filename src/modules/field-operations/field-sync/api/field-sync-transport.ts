import type { EvidenceType } from '@/modules/evidence/evidence-intake.types'
import type { RemoteSubmissionSnapshot } from '@/modules/field-operations/field-sync/engine/field-sync-reconciliation'

export interface CreateSubmissionPayload {
  mission_id: string
  mission_task_id: string
  evidence_type: EvidenceType
  captured_at: string | null
  device_timestamp: string | null
  description?: string
  location?: {
    geometry?: { type: 'Point'; coordinates: [number, number] } | null
    accuracy_m?: number | null
    method?: string | null
  }
  metadata?: Record<string, unknown>
  requirement_ids?: string[]
  idempotency_key: string
}

export interface SyncTransport {
  registerBundle(input: {
    bundle_id: string
    bundle_checksum: string
    mission_id: string
    package_id: string
    package_version: number
    task_id: string
    idempotency_key: string
  }): Promise<{ registration_id: string; idempotent_replay: boolean }>

  createSubmission(
    missionId: string,
    payload: CreateSubmissionPayload,
  ): Promise<{ submission_id: string; idempotent_replay: boolean; status: string }>

  startUploadSession(
    submissionId: string,
    input: {
      local_asset_id: string
      mime_type: string
      original_filename: string
      expected_size_bytes: number
      expected_checksum_sha256: string
      idempotency_key: string
    },
  ): Promise<{
    upload_session_id: string
    upload_url: string
    storage_path: string
    expires_at: string
    idempotent_replay: boolean
    bytes_transferred: number
  }>

  renewUploadUrl(
    submissionId: string,
    uploadSessionId: string,
  ): Promise<{ upload_url: string; expires_at: string }>

  getUploadSessionStatus(
    submissionId: string,
    uploadSessionId: string,
  ): Promise<{ status: string; bytes_transferred: number }>

  putUploadBytes(
    uploadUrl: string,
    chunk: Uint8Array,
    offset: number,
    total: number,
  ): Promise<{ bytes_written: number }>

  confirmUpload(
    submissionId: string,
    input: {
      storage_path: string
      original_filename: string
      mime_type: string
      size_bytes: number
      checksum_sha256: string
      captured_at?: string | null
      duration_seconds?: number | null
      idempotency_key: string
    },
  ): Promise<{ asset_id: string; idempotent_replay: boolean }>

  addObservation(
    submissionId: string,
    input: { fields: Record<string, unknown>; idempotency_key: string },
  ): Promise<{ idempotent_replay: boolean }>

  linkRequirements(
    submissionId: string,
    input: {
      links: Array<{
        requirement_id: string
        match_type: string
        match_score: number
        match_reason: string
        preliminary_coverage: string
        idempotency_key: string
      }>
    },
  ): Promise<{ linked_count: number }>

  finalizeSubmission(
    submissionId: string,
    input: { idempotency_key: string },
  ): Promise<{ status: string }>

  getSubmissionReconciliation(submissionId: string): Promise<RemoteSubmissionSnapshot>

  getMissionStatus(missionId: string): Promise<{ status: string; cancelled: boolean }>

  getPackageRemoteStatus(packageId: string): Promise<{ revoked: boolean; superseded: boolean }>
}
