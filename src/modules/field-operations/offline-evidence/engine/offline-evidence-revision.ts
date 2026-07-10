import type { LocalEvidenceBundle } from '@/modules/field-operations/offline-evidence/offline-evidence.types'
import { OfflineEvidenceRepository } from '@/modules/field-operations/offline-evidence/offline-evidence.repository'
import { newBundleId, newEventId } from '@/modules/field-operations/offline-evidence/engine/structured-evidence-from-form'

export async function createBundleRevision(input: {
  repo: OfflineEvidenceRepository
  previous: LocalEvidenceBundle
  tab_id: string
  now_iso: string
}): Promise<LocalEvidenceBundle> {
  const superseded: LocalEvidenceBundle = {
    ...input.previous,
    status: 'superseded',
    updated_at: input.now_iso,
  }
  await input.repo.saveBundle(superseded)

  const revision: LocalEvidenceBundle = {
    ...input.previous,
    bundle_id: newBundleId(),
    supersedes_bundle_id: input.previous.bundle_id,
    status: 'pending_sync',
    created_at: input.now_iso,
    updated_at: input.now_iso,
    tab_id: input.tab_id,
  }
  await input.repo.saveBundle(revision)
  await input.repo.saveEvent({
    event_id: newEventId(),
    local_evidence_id: null,
    bundle_id: revision.bundle_id,
    event_type: 'bundle_revision',
    payload: { supersedes: input.previous.bundle_id },
    created_at: input.now_iso,
  })
  return revision
}
