import { describe, expect, it } from 'vitest'

import { FIRE_OFFLINE_EVIDENCE_MODEL_VERSION, LOW_STORAGE_WARNING_BYTES } from '@/modules/field-operations/offline-evidence/config/fire-offline-evidence.config'
import { bundleBodyChecksum } from '@/modules/field-operations/offline-evidence/engine/offline-evidence-bundle'
import {
  addTimestampedNote,
  assertCaptureAllowed,
  buildAndFinalizeTaskBundle,
  buildGeoLocation,
  captureContextFromPackage,
  capturePhotoEvidence,
  captureVideoEvidence,
  createStructuredEvidenceFromForm,
  deleteLocalEvidence,
  estimateStorageWarning,
  verifyAllAssets,
} from '@/modules/field-operations/offline-evidence/engine/offline-evidence-capture'
import { detectEvidenceTabConflict } from '@/modules/field-operations/offline-evidence/engine/offline-evidence-tab-conflict'
import { createBundleRevision } from '@/modules/field-operations/offline-evidence/engine/offline-evidence-revision'
import { computeRequirementCoverage, parseRequirementsFromPackage } from '@/modules/field-operations/offline-evidence/engine/offline-evidence-matching'
import { scanNoteText } from '@/modules/field-operations/offline-evidence/offline-evidence-copy-guard'
import { OfflineEvidenceRepository } from '@/modules/field-operations/offline-evidence/offline-evidence.repository'
import type { LocalEvidenceRecord } from '@/modules/field-operations/offline-evidence/offline-evidence.types'
import { buildFieldFormOutput } from '@/modules/field-operations/field-forms/engine/field-form-output'
import { buildOfflinePackage } from '@/modules/field-operations/offline-packages/engine/offline-package.engine'
import { ALL_OFFLINE_PACKAGE_PERMISSIONS } from '@/modules/field-operations/offline-packages/offline-package-permissions'
import type { LocalOfflinePackageRecord } from '@/modules/field-operations/offline-packages/offline-package.repository'

const EVALUATED_AT = '2026-07-10T12:00:00.000Z'
const TASK_OBS = '00000000-0000-4000-a002-000000000101'
const TASK_PHOTO = '00000000-0000-4000-a002-000000000102'
const PACKAGE_ID = '00000000-0000-4000-a002-000000000501'

function photoBytes(label: string): Uint8Array {
  return new TextEncoder().encode(`synthetic-jpeg-${label}`)
}

function buildPkg(options: {
  evidence?: Array<Record<string, unknown>>
  tasks?: Array<Record<string, unknown>>
  local_status?: LocalOfflinePackageRecord['local_status']
}): LocalOfflinePackageRecord {
  const mission = {
    id: '00000000-0000-4000-a002-000000000001',
    mission_type: 'field_visual_inspection',
    title: 'Inspección campo',
    objective: 'Evidencia offline.',
    status: 'ready',
    incident_id: '00000000-0000-4000-a002-000000000010',
    verification_plan_id: '00000000-0000-4000-a002-000000000020',
    recommended_method_code: 'field_visual_inspection',
    location_geometry: { type: 'Point', coordinates: [-90.5, 14.6] },
    location_description: 'Sector norte',
    priority: 70,
    earliest_start_at: '2026-07-10T08:00:00.000Z',
    due_at: '2026-07-11T08:00:00.000Z',
    expires_at: '2026-07-12T08:00:00.000Z',
    completion_criteria: { text: 'Observación completada' },
    inconclusive_criteria: { text: 'Visibilidad limitada' },
    blocking_conditions: [],
    cancellation_conditions: [],
    mission_profile_version: '1.0.0',
    source_snapshot: { reasons: [], eligibility: { limitations: [] } },
    context_signature: 'ctx-evidence',
  }
  const tasks = options.tasks ?? [
    {
      id: TASK_OBS,
      sequence: 1,
      task_type: 'structured_observation',
      title: 'Observación',
      instructions: 'Documentar.',
      required: true,
      completion_criteria: { text: 'Hecho' },
      status: 'pending',
    },
    {
      id: TASK_PHOTO,
      sequence: 2,
      task_type: 'capture_georeferenced_photos',
      title: 'Fotos',
      instructions: 'Capturar fotos georreferenciadas.',
      required: true,
      completion_criteria: { text: 'Hecho' },
      status: 'pending',
    },
  ]
  const evidence = options.evidence ?? [
    {
      id: '00000000-0000-4000-a002-000000000201',
      evidence_type: 'structured_observation',
      required: true,
      minimum_count: 1,
      required_metadata: [],
      quality_criteria: [],
      acceptance_criteria: { text: 'Observación' },
    },
    {
      id: '00000000-0000-4000-a002-000000000202',
      evidence_type: 'georeferenced_photo',
      required: true,
      minimum_count: 2,
      required_metadata: ['lat', 'lon', 'timestamp'],
      quality_criteria: [],
      acceptance_criteria: { text: 'Fotos GPS' },
    },
  ]
  const built = buildOfflinePackage({
    package_id: PACKAGE_ID,
    package_version: 1,
    mission,
    tasks,
    evidence_requirements: evidence,
    assignment: null,
    plan_needs: [],
    incident: null,
    permissions: ALL_OFFLINE_PACKAGE_PERMISSIONS,
    actor_id: 'test',
    evaluated_at: EVALUATED_AT,
    signingKey: 'test-key',
  })
  const manifest = JSON.parse(built.payloads.find((p) => p.path === 'manifest.json')!.content)
  return {
    package_id: manifest.package_id,
    mission_id: mission.id as string,
    mission_title: mission.title as string,
    package_version: 1,
    local_status: options.local_status ?? 'available',
    manifest,
    payloads: built.payloads.filter((p) => p.path !== 'manifest.json'),
    downloaded_at: EVALUATED_AT,
    superseded_by: null,
    size_bytes: 1000,
    integrity_errors: [],
    updated_at: EVALUATED_AT,
  }
}

function ctx(pkg: LocalOfflinePackageRecord, taskId: string, tab = 'tab-a') {
  return captureContextFromPackage(pkg, taskId, tab, EVALUATED_AT)
}

function formOutput(taskId: string) {
  return buildFieldFormOutput({
    response_id: '00000000-0000-4000-a002-000000000301',
    mission_id: '00000000-0000-4000-a002-000000000001',
    task_id: taskId,
    requirement_id: null,
    schema_id: 'field_visual_observation',
    schema_version: '1.0.0',
    status: 'complete',
    answers: {
      observation_datetime: EVALUATED_AT,
      visibility_conditions: 'clear',
      access_possible: 'yes',
      visible_smoke: 'no',
      visible_flame: 'no',
    },
    limitations: [],
    captured_at: EVALUATED_AT,
    device_location: {},
    package_version: 1,
    package_id: PACKAGE_ID,
  })
}

describe('offline evidence capture — 8B.7C', () => {
  it('freezes fire-offline-evidence model v1.0.0', () => {
    expect(FIRE_OFFLINE_EVIDENCE_MODEL_VERSION).toBe('1.0.0')
  })

  it('captures photo offline and persists', async () => {
    const repo = OfflineEvidenceRepository.createInMemory()
    const pkg = buildPkg({})
    const result = await capturePhotoEvidence({
      repo,
      ctx: ctx(pkg, TASK_PHOTO),
      pkg_payloads: pkg.payloads,
      bytes: photoBytes('a'),
      mime_type: 'image/jpeg',
      filename: 'campo.jpg',
      location: buildGeoLocation({
        lat: 14.6,
        lng: -90.5,
        accuracy_m: 12,
        permission: 'granted',
        now_iso: EVALUATED_AT,
      }),
    })
    expect(result.ok).toBe(true)
    expect(result.record?.evidence_type).toBe('georeferenced_photo')
    const stored = await repo.listRecordsForTask(pkg.package_id, TASK_PHOTO)
    expect(stored).toHaveLength(1)
    const assets = await repo.listAssetsForEvidence(stored[0]!.local_evidence_id)
    expect(assets[0]?.sha256).toHaveLength(64)
  })

  it('captures video within limits', async () => {
    const repo = OfflineEvidenceRepository.createInMemory()
    const pkg = buildPkg({})
    const result = await captureVideoEvidence({
      repo,
      ctx: ctx(pkg, TASK_PHOTO),
      pkg_payloads: pkg.payloads,
      bytes: photoBytes('video-clip'),
      mime_type: 'video/mp4',
      filename: 'clip.mp4',
      duration_seconds: 30,
    })
    expect(result.ok).toBe(true)
    expect(result.record?.evidence_type).toBe('video')
  })

  it('GPS denied keeps asset and records limitation', async () => {
    const repo = OfflineEvidenceRepository.createInMemory()
    const pkg = buildPkg({})
    const result = await capturePhotoEvidence({
      repo,
      ctx: ctx(pkg, TASK_PHOTO),
      pkg_payloads: pkg.payloads,
      bytes: photoBytes('no-gps'),
      mime_type: 'image/jpeg',
      filename: 'sin-gps.jpg',
      location: buildGeoLocation({ permission: 'denied', now_iso: EVALUATED_AT }),
    })
    expect(result.ok).toBe(true)
    expect(result.record?.evidence_type).toBe('timestamped_photo')
    expect(result.record?.limitations).toContain('gps_unavailable')
  })

  it('preserves capture timestamp separately from sync time', async () => {
    const repo = OfflineEvidenceRepository.createInMemory()
    const pkg = buildPkg({})
    const captureTime = '2026-07-10T09:15:00.000Z'
    const result = await capturePhotoEvidence({
      repo,
      ctx: captureContextFromPackage(pkg, TASK_PHOTO, 'tab-a', captureTime),
      pkg_payloads: pkg.payloads,
      bytes: photoBytes('ts'),
      mime_type: 'image/jpeg',
      filename: 'ts.jpg',
    })
    expect(result.record?.captured_at).toBe(captureTime)
    expect(result.record?.metadata.timestamp).toBeTruthy()
  })

  it('structured form output generates evidence record', async () => {
    const repo = OfflineEvidenceRepository.createInMemory()
    const pkg = buildPkg({})
    const output = formOutput(TASK_OBS)
    const created = await createStructuredEvidenceFromForm({
      repo,
      ctx: ctx(pkg, TASK_OBS),
      output,
      pkg_payloads: pkg.payloads,
    })
    expect(created.created).toBe(true)
    expect(created.record?.evidence_type).toBe('structured_observation')
    expect(created.record?.form_response_id).toBe(output.response_id)
  })

  it('does not duplicate same structured output', async () => {
    const repo = OfflineEvidenceRepository.createInMemory()
    const pkg = buildPkg({})
    const output = formOutput(TASK_OBS)
    const first = await createStructuredEvidenceFromForm({
      repo,
      ctx: ctx(pkg, TASK_OBS),
      output,
      pkg_payloads: pkg.payloads,
    })
    const second = await createStructuredEvidenceFromForm({
      repo,
      ctx: ctx(pkg, TASK_OBS),
      output,
      pkg_payloads: pkg.payloads,
    })
    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
    expect(second.reason).toBe('duplicate_form_output')
    expect(await repo.listRecordsForTask(pkg.package_id, TASK_OBS)).toHaveLength(1)
  })

  it('detects exact asset duplicate', async () => {
    const repo = OfflineEvidenceRepository.createInMemory()
    const pkg = buildPkg({})
    const bytes = photoBytes('dup')
    const base = {
      repo,
      ctx: ctx(pkg, TASK_PHOTO),
      pkg_payloads: pkg.payloads,
      bytes,
      mime_type: 'image/jpeg',
      filename: 'a.jpg',
    }
    expect((await capturePhotoEvidence(base)).ok).toBe(true)
    expect((await capturePhotoEvidence({ ...base, filename: 'b.jpg' })).ok).toBe(false)
  })

  it('requirement matching and preliminary coverage show missing items', async () => {
    const repo = OfflineEvidenceRepository.createInMemory()
    const pkg = buildPkg({})
    await capturePhotoEvidence({
      repo,
      ctx: ctx(pkg, TASK_PHOTO),
      pkg_payloads: pkg.payloads,
      bytes: photoBytes('one'),
      mime_type: 'image/jpeg',
      filename: 'one.jpg',
      location: buildGeoLocation({
        lat: 14.6,
        lng: -90.5,
        accuracy_m: 20,
        permission: 'granted',
        now_iso: EVALUATED_AT,
      }),
    })
    const reqs = parseRequirementsFromPackage(pkg.payloads)
    const records = await repo.listRecordsForTask(pkg.package_id, TASK_PHOTO)
    const links = await repo.listLinksForPackage(pkg.package_id)
    const coverage = computeRequirementCoverage(reqs, records, links)
    const photoReq = coverage.find((c) => c.evidence_type === 'georeferenced_photo')
    expect(photoReq?.captured_count).toBe(1)
    expect(photoReq?.missing_count).toBe(1)
    expect(photoReq?.coverage_status).toBe('partial')
  })

  it('incomplete bundle stays incomplete when critical evidence missing', async () => {
    const repo = OfflineEvidenceRepository.createInMemory()
    const pkg = buildPkg({})
    await createStructuredEvidenceFromForm({
      repo,
      ctx: ctx(pkg, TASK_OBS),
      output: formOutput(TASK_OBS),
      pkg_payloads: pkg.payloads,
    })
    const { bundle } = await buildAndFinalizeTaskBundle({
      repo,
      pkg,
      task_id: TASK_PHOTO,
      tab_id: 'tab-a',
    })
    expect(bundle.status).toBe('incomplete')
  })

  it('bundle with limitations may pending_sync when allowed', async () => {
    const repo = OfflineEvidenceRepository.createInMemory()
    const pkg = buildPkg({
      evidence: [
        {
          id: '00000000-0000-4000-a002-000000000201',
          evidence_type: 'structured_observation',
          required: true,
          minimum_count: 1,
          required_metadata: [],
          quality_criteria: [],
          acceptance_criteria: { text: 'Observación' },
        },
      ],
      tasks: [
        {
          id: TASK_OBS,
          sequence: 1,
          task_type: 'structured_observation',
          title: 'Observación',
          instructions: 'Documentar.',
          required: true,
          completion_criteria: { text: 'Hecho' },
          status: 'pending',
        },
      ],
    })
    await createStructuredEvidenceFromForm({
      repo,
      ctx: ctx(pkg, TASK_OBS),
      output: { ...formOutput(TASK_OBS), limitations: ['visibilidad limitada'] },
      pkg_payloads: pkg.payloads,
    })
    const { bundle } = await buildAndFinalizeTaskBundle({
      repo,
      pkg,
      task_id: TASK_OBS,
      allow_limitations: true,
      tab_id: 'tab-a',
    })
    expect(bundle.status).toBe('pending_sync')
    expect(bundle.limitations.length).toBeGreaterThan(0)
  })

  it('checksum detects blob modification', async () => {
    const repo = OfflineEvidenceRepository.createInMemory()
    const pkg = buildPkg({})
    await capturePhotoEvidence({
      repo,
      ctx: ctx(pkg, TASK_PHOTO),
      pkg_payloads: pkg.payloads,
      bytes: photoBytes('integrity'),
      mime_type: 'image/jpeg',
      filename: 'integrity.jpg',
    })
    const assets = await repo.listAssetsForPackage(pkg.package_id)
    await repo.putBlob(assets[0]!.blob_reference, photoBytes('tampered'))
    const { corrupted } = await verifyAllAssets(repo, pkg.package_id)
    expect(corrupted.length).toBe(1)
    const record = await repo.getRecord(corrupted[0]!)
    expect(record?.status).toBe('corrupted')
  })

  it('missing blob marks record corrupted', async () => {
    const repo = OfflineEvidenceRepository.createInMemory()
    const pkg = buildPkg({})
    await capturePhotoEvidence({
      repo,
      ctx: ctx(pkg, TASK_PHOTO),
      pkg_payloads: pkg.payloads,
      bytes: photoBytes('missing'),
      mime_type: 'image/jpeg',
      filename: 'missing.jpg',
    })
    const assets = await repo.listAssetsForPackage(pkg.package_id)
    await repo.deleteBlob(assets[0]!.blob_reference)
    await verifyAllAssets(repo, pkg.package_id)
    const record = await repo.getRecord(assets[0]!.local_evidence_id)
    expect(record?.status).toBe('corrupted')
  })

  it('recovers draft records after reload from repository', async () => {
    const repo = OfflineEvidenceRepository.createInMemory()
    const pkg = buildPkg({})
    await capturePhotoEvidence({
      repo,
      ctx: ctx(pkg, TASK_PHOTO),
      pkg_payloads: pkg.payloads,
      bytes: photoBytes('reload'),
      mime_type: 'image/jpeg',
      filename: 'reload.jpg',
    })
    const reloaded = await repo.listRecordsForTask(pkg.package_id, TASK_PHOTO)
    expect(reloaded).toHaveLength(1)
    expect(reloaded[0]?.status).toBe('ready')
  })

  it('revoked package blocks new capture but preserves existing evidence', async () => {
    const repo = OfflineEvidenceRepository.createInMemory()
    const pkg = buildPkg({})
    await capturePhotoEvidence({
      repo,
      ctx: ctx(pkg, TASK_PHOTO),
      pkg_payloads: pkg.payloads,
      bytes: photoBytes('kept'),
      mime_type: 'image/jpeg',
      filename: 'kept.jpg',
    })
    pkg.local_status = 'revoked'
    const blocked = await capturePhotoEvidence({
      repo,
      ctx: ctx(pkg, TASK_PHOTO),
      pkg_payloads: pkg.payloads,
      bytes: photoBytes('new'),
      mime_type: 'image/jpeg',
      filename: 'new.jpg',
    })
    expect(blocked.ok).toBe(false)
    expect(blocked.reason).toBe('package_revoked')
    expect(await repo.listRecordsForTask(pkg.package_id, TASK_PHOTO)).toHaveLength(1)
  })

  it('superseded package blocks new capture', async () => {
    const pkg = buildPkg({ local_status: 'superseded' })
    expect(assertCaptureAllowed(ctx(pkg, TASK_PHOTO)).ok).toBe(false)
  })

  it('revision preserves previous bundle', async () => {
    const repo = OfflineEvidenceRepository.createInMemory()
    const pkg = buildPkg({
      evidence: [
        {
          id: '00000000-0000-4000-a002-000000000201',
          evidence_type: 'structured_observation',
          required: true,
          minimum_count: 1,
          required_metadata: [],
          quality_criteria: [],
          acceptance_criteria: { text: 'Observación' },
        },
      ],
      tasks: [
        {
          id: TASK_OBS,
          sequence: 1,
          task_type: 'structured_observation',
          title: 'Observación',
          instructions: 'Documentar.',
          required: true,
          completion_criteria: { text: 'Hecho' },
          status: 'pending',
        },
      ],
    })
    await createStructuredEvidenceFromForm({
      repo,
      ctx: ctx(pkg, TASK_OBS),
      output: formOutput(TASK_OBS),
      pkg_payloads: pkg.payloads,
    })
    const { bundle: original } = await buildAndFinalizeTaskBundle({
      repo,
      pkg,
      task_id: TASK_OBS,
      allow_limitations: true,
      tab_id: 'tab-a',
    })
    const revision = await createBundleRevision({
      repo,
      previous: original,
      tab_id: 'tab-b',
      now_iso: EVALUATED_AT,
    })
    const old = await repo.getBundle(original.bundle_id)
    expect(old?.status).toBe('superseded')
    expect(revision.supersedes_bundle_id).toBe(original.bundle_id)
  })

  it('asset order does not change bundle checksum', () => {
    const records = [
      { local_evidence_id: 'e1', evidence_type: 'video', checksum: 'a', captured_at: EVALUATED_AT, status: 'ready', task_id: TASK_PHOTO },
      { local_evidence_id: 'e2', evidence_type: 'georeferenced_photo', checksum: 'b', captured_at: EVALUATED_AT, status: 'ready', task_id: TASK_PHOTO },
    ] as LocalEvidenceRecord[]
    const assetsA = [
      { local_asset_id: 'a1', sha256: '1', captured_at: EVALUATED_AT, local_evidence_id: 'e1', size_bytes: 1 },
      { local_asset_id: 'a2', sha256: '2', captured_at: EVALUATED_AT, local_evidence_id: 'e2', size_bytes: 1 },
    ] as never[]
    const assetsB = [assetsA[1], assetsA[0]]
    const base = {
      bundle_id: 'b1',
      package_id: PACKAGE_ID,
      package_version: 1,
      mission_id: 'm1',
      task_id: TASK_PHOTO,
      form_response_ids: [] as string[],
      evidence_records: records,
      requirement_links: [],
      limitations: [] as string[],
      status: 'pending_sync',
    }
    expect(bundleBodyChecksum({ ...base, assets: assetsA })).toBe(
      bundleBodyChecksum({ ...base, assets: assetsB }),
    )
  })

  it('detects tab conflict on capturing record', () => {
    const records = [
      {
        local_evidence_id: 'e1',
        task_id: TASK_PHOTO,
        status: 'capturing',
        tab_id: 'tab-other',
      },
    ] as LocalEvidenceRecord[]
    expect(detectEvidenceTabConflict(records, TASK_PHOTO, 'tab-a').conflict).toBe(true)
  })

  it('low storage warning does not delete pending_sync bundles', async () => {
    const repo = OfflineEvidenceRepository.createInMemory()
    const big = new Uint8Array(LOW_STORAGE_WARNING_BYTES + 1024)
    await repo.putBlob('big', big)
    expect(await estimateStorageWarning(repo)).toBe('low_storage_warning')
    const pkg = buildPkg({
      evidence: [
        {
          id: '00000000-0000-4000-a002-000000000201',
          evidence_type: 'structured_observation',
          required: true,
          minimum_count: 1,
          required_metadata: [],
          quality_criteria: [],
          acceptance_criteria: { text: 'Observación' },
        },
      ],
      tasks: [
        {
          id: TASK_OBS,
          sequence: 1,
          task_type: 'structured_observation',
          title: 'Observación',
          instructions: 'Documentar.',
          required: true,
          completion_criteria: { text: 'Hecho' },
          status: 'pending',
        },
      ],
    })
    await createStructuredEvidenceFromForm({
      repo,
      ctx: ctx(pkg, TASK_OBS),
      output: formOutput(TASK_OBS),
      pkg_payloads: pkg.payloads,
    })
    const { bundle } = await buildAndFinalizeTaskBundle({
      repo,
      pkg,
      task_id: TASK_OBS,
      allow_limitations: true,
      tab_id: 'tab-a',
    })
    expect(bundle.status).toBe('pending_sync')
    expect(await repo.getBundle(bundle.bundle_id)).toBeTruthy()
  })

  it('rejects forbidden copy in notes', async () => {
    const repo = OfflineEvidenceRepository.createInMemory()
    const pkg = buildPkg({})
    expect(scanNoteText('incendio confirmado')).toBeTruthy()
    const result = await addTimestampedNote({
      repo,
      ctx: ctx(pkg, TASK_PHOTO),
      pkg_payloads: pkg.payloads,
      note: 'incendio confirmado en el sector',
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('forbidden_copy')
  })

  it('delete keeps audit event and marks deleted_pending_sync', async () => {
    const repo = OfflineEvidenceRepository.createInMemory()
    const pkg = buildPkg({})
    const captured = await capturePhotoEvidence({
      repo,
      ctx: ctx(pkg, TASK_PHOTO),
      pkg_payloads: pkg.payloads,
      bytes: photoBytes('del'),
      mime_type: 'image/jpeg',
      filename: 'del.jpg',
    })
    await deleteLocalEvidence({
      repo,
      evidence_id: captured.record!.local_evidence_id,
      confirm: true,
    })
    const record = await repo.getRecord(captured.record!.local_evidence_id)
    expect(record?.status).toBe('deleted_pending_sync')
    const events = await repo.listEvents(5)
    expect(events.some((e) => e.event_type === 'delete_requested')).toBe(true)
  })
})
