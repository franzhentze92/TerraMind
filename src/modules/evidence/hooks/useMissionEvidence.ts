import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  confirmEvidenceUpload,
  createEvidenceSubmission,
  fetchEvidenceSubmissionDetail,
  fetchMissionEvidence,
  requestEvidenceUploadUrl,
  submitStructuredObservation,
  withdrawEvidenceSubmission,
} from '../api/evidence-api'
import type { EvidenceSourceType, EvidenceType } from '../evidence-intake.types'

export function useMissionEvidence(missionId: string | undefined) {
  return useQuery({
    queryKey: ['mission-evidence', missionId],
    queryFn: () => fetchMissionEvidence(missionId!),
    enabled: Boolean(missionId),
  })
}

export function useEvidenceSubmissionDetail(submissionId: string | undefined) {
  return useQuery({
    queryKey: ['evidence-submission', submissionId],
    queryFn: () => fetchEvidenceSubmissionDetail(submissionId!),
    enabled: Boolean(submissionId),
  })
}

export function useEvidenceIntake(missionId: string | undefined) {
  const queryClient = useQueryClient()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['mission-evidence', missionId] })
    queryClient.invalidateQueries({ queryKey: ['mission', missionId] })
  }

  const createSubmission = useMutation({
    mutationFn: (payload: {
      evidence_type: EvidenceType
      source_type: EvidenceSourceType
      description?: string
      captured_at?: string
      location?: { geometry?: { type: 'Point'; coordinates: [number, number] } }
    }) => createEvidenceSubmission(missionId!, payload),
    onSuccess: invalidate,
  })

  const uploadFile = useMutation({
    mutationFn: async (input: {
      submissionId: string
      file: File
      checksum?: string
    }) => {
      const url = await requestEvidenceUploadUrl(input.submissionId, {
        original_filename: input.file.name,
        mime_type: input.file.type || 'application/octet-stream',
      })
      const putRes = await fetch(url.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': input.file.type || 'application/octet-stream' },
        body: input.file,
      })
      if (!putRes.ok) throw new Error('Error al subir archivo')
      return confirmEvidenceUpload(input.submissionId, {
        storage_path: url.storage_path,
        original_filename: input.file.name,
        mime_type: input.file.type || 'application/octet-stream',
        size_bytes: input.file.size,
        checksum_sha256: input.checksum,
        idempotency_key: `upload-${input.file.name}-${input.file.size}`,
      })
    },
    onSuccess: invalidate,
  })

  const addObservation = useMutation({
    mutationFn: (input: { submissionId: string; fields: Record<string, unknown> }) =>
      submitStructuredObservation(input.submissionId, input.fields),
    onSuccess: invalidate,
  })

  const withdraw = useMutation({
    mutationFn: (input: { submissionId: string; reason: string }) =>
      withdrawEvidenceSubmission(input.submissionId, input.reason),
    onSuccess: invalidate,
  })

  return { createSubmission, uploadFile, addObservation, withdraw }
}
