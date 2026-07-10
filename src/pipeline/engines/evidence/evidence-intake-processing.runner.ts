import { evaluateEvidenceProcessing } from '@/modules/evidence/engine/evidence-intake-processing.engine'
import {
  getEvidenceObservation,
  getEvidenceSubmissionById,
  listEvidenceAssets,
  listExistingAssetFingerprints,
  recordIntakeEvent,
  updateSubmissionStatus,
  upsertRequirementLinks,
} from '@/pipeline/stores/evidence-intake.store'
import {
  getMissionById,
  listMissionEvidenceRequirements,
} from '@/pipeline/stores/missions.store'

function mapRequirements(rows: Array<Record<string, unknown>>) {
  return rows.map((r) => ({
    id: String(r.id),
    evidence_type: String(r.evidence_type),
    required: Boolean(r.required),
    minimum_count: Number(r.minimum_count),
    required_metadata: (r.required_metadata as string[]) ?? [],
    verification_need_id: r.verification_need_id ? String(r.verification_need_id) : null,
  }))
}

export async function runEvidenceProcessing(submissionId: string): Promise<void> {
  const submission = await getEvidenceSubmissionById(submissionId)
  if (!submission) throw new Error('Submission no encontrada')
  if (['withdrawn', 'duplicate', 'ready_for_validation'].includes(String(submission.status))) {
    return
  }

  const mission = await getMissionById(String(submission.mission_id))
  if (!mission) throw new Error('Misión no encontrada')

  const requirements = mapRequirements(
    await listMissionEvidenceRequirements(String(submission.mission_id)),
  )
  const assets = await listEvidenceAssets(submissionId)
  const observation = await getEvidenceObservation(submissionId)
  const existing = await listExistingAssetFingerprints(String(submission.mission_id))

  const result = evaluateEvidenceProcessing({
    submission_id: submissionId,
    mission_id: String(submission.mission_id),
    submitted_by_id: String(submission.submitted_by_id),
    submitted_at: String(submission.submitted_at),
    evidence_type: String(submission.evidence_type),
    captured_at: submission.captured_at as string | null,
    location_geometry: submission.location_geometry as {
      type: 'Point'
      coordinates: [number, number]
    } | null,
    device_location_geometry: submission.device_location_geometry as {
      type: 'Point'
      coordinates: [number, number]
    } | null,
    mission_area: mission.location_geometry as { type: string; coordinates: number[][][] } | null,
    requirements,
    assets: assets.map((a) => ({
      original_filename: String(a.original_filename),
      mime_type: String(a.mime_type),
      size_bytes: Number(a.size_bytes),
      checksum_sha256: a.checksum_sha256 as string | null,
    })),
    has_observation: Boolean(observation),
    existing_assets: existing.filter((e) => e.submission_id !== submissionId),
  })

  await upsertRequirementLinks(submissionId, result.requirement_links)
  await updateSubmissionStatus({
    submissionId,
    status: result.submission_status,
    processed_at: new Date().toISOString(),
    location_outside_mission_area: result.location_outside_mission_area,
    location_discrepancy_m: result.location_discrepancy_m,
  })
  await recordIntakeEvent({
    submissionId,
    eventType: 'processing_completed',
    actorType: 'system',
    payload: {
      status: result.submission_status,
      reasons: result.reasons,
      warnings: result.warnings,
      deduplication: result.deduplication,
    },
  })
}
