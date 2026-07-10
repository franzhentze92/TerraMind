import type {
  EvidenceCoverageSnapshot,
  EvidenceType,
  EvidenceSourceType,
} from '@/modules/evidence/evidence-intake.types'

export interface EvidenceSubmissionSummary {
  id: string
  mission_id: string
  evidence_type: string
  status: string
  submitted_at: string
  captured_at: string | null
  description: string
  submitted_by_id: string
  location_outside_mission_area: boolean
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'include' })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json() as Promise<T>
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `API error ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function fetchMissionEvidence(missionId: string) {
  return apiFetch<{
    submissions: EvidenceSubmissionSummary[]
    requirements: Array<Record<string, unknown>>
    coverage: EvidenceCoverageSnapshot
    generated_at: string
  }>(`/api/operations/missions/${missionId}/evidence`)
}

export function fetchMissionEvidenceCoverage(missionId: string) {
  return apiFetch<EvidenceCoverageSnapshot>(
    `/api/operations/missions/${missionId}/evidence-coverage`,
  )
}

export function fetchEvidenceSubmissionDetail(submissionId: string) {
  return apiFetch<Record<string, unknown>>(
    `/api/operations/evidence-submissions/${submissionId}`,
  )
}

export function createEvidenceSubmission(
  missionId: string,
  payload: {
    evidence_type: EvidenceType
    source_type: EvidenceSourceType
    description?: string
    captured_at?: string
    mission_task_id?: string
    location?: {
      geometry?: { type: 'Point'; coordinates: [number, number] }
      accuracy_m?: number
    }
    idempotency_key?: string
  },
) {
  return apiPost<{ ok: boolean; submission: Record<string, unknown> }>(
    `/api/operations/missions/${missionId}/evidence-submissions`,
    payload,
  )
}

export function requestEvidenceUploadUrl(
  submissionId: string,
  payload: { original_filename: string; mime_type: string },
) {
  return apiPost<{
    upload_url: string
    storage_path: string
    expires_in: number
  }>(`/api/operations/evidence-submissions/${submissionId}/upload-url`, payload)
}

export function confirmEvidenceUpload(
  submissionId: string,
  payload: {
    storage_path: string
    original_filename: string
    mime_type: string
    size_bytes: number
    checksum_sha256?: string
    idempotency_key?: string
  },
) {
  return apiPost<{ ok: boolean; asset: Record<string, unknown> }>(
    `/api/operations/evidence-submissions/${submissionId}/confirm-upload`,
    payload,
  )
}

export function submitStructuredObservation(
  submissionId: string,
  fields: Record<string, unknown>,
) {
  return apiPost<{ ok: boolean }>(
    `/api/operations/evidence-submissions/${submissionId}/observations`,
    { fields },
  )
}

export function withdrawEvidenceSubmission(submissionId: string, reason: string) {
  return apiPost<{ ok: boolean }>(
    `/api/operations/evidence-submissions/${submissionId}/withdraw`,
    { reason },
  )
}

export function fetchEvidenceValidation(submissionId: string) {
  return apiFetch<Record<string, unknown>>(
    `/api/operations/evidence-submissions/${submissionId}/validation`,
  )
}

export function fetchEvidenceValidationHistory(submissionId: string) {
  return apiFetch<{ items: Array<Record<string, unknown>> }>(
    `/api/operations/evidence-submissions/${submissionId}/validation-history`,
  )
}

export function fetchMissionEvidenceQualitySummary(missionId: string) {
  return apiFetch<Record<string, unknown>>(
    `/api/operations/missions/${missionId}/evidence-quality-summary`,
  )
}

export function revalidateEvidenceSubmission(submissionId: string, idempotencyKey?: string) {
  return apiPost<{ ok: boolean }>(
    `/api/operations/evidence-submissions/${submissionId}/revalidate`,
    { idempotency_key: idempotencyKey },
  )
}
