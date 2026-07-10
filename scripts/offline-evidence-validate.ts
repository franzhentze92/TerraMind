import { FIRE_OFFLINE_EVIDENCE_MODEL_VERSION, PHOTO_MIME_ALLOWLIST, VIDEO_MIME_ALLOWLIST } from '@/modules/field-operations/offline-evidence/config/fire-offline-evidence.config'
import { bundleBodyChecksum } from '@/modules/field-operations/offline-evidence/engine/offline-evidence-bundle'

const sampleChecksum = bundleBodyChecksum({
  bundle_id: 'sample',
  package_id: 'sample-package',
  package_version: 1,
  mission_id: 'sample-mission',
  task_id: 'sample-task',
  form_response_ids: [],
  evidence_records: [],
  assets: [],
  requirement_links: [],
  limitations: [],
  status: 'incomplete',
})

console.log(
  JSON.stringify(
    {
      model_version: FIRE_OFFLINE_EVIDENCE_MODEL_VERSION,
      photo_mime_allowlist: PHOTO_MIME_ALLOWLIST,
      video_mime_allowlist: VIDEO_MIME_ALLOWLIST,
      empty_bundle_checksum: sampleChecksum,
      valid: sampleChecksum.length === 64,
      generated_at: new Date().toISOString(),
    },
    null,
    2,
  ),
)

process.exit(sampleChecksum.length === 64 ? 0 : 1)
