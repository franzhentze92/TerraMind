import { describe, expect, it } from 'vitest'

import {
  FIELD_REAL_SYNC_ENABLED,
  FIRE_FIELD_MOBILE_MODEL_VERSION,
  LOW_STORAGE_WARNING_BYTES,
} from '@/modules/field-operations/field-mobile/config/fire-field-mobile.config'
import { probeFieldConnectivity } from '@/modules/field-operations/field-mobile/engine/field-connectivity'
import {
  assertCleanupAllowed,
  computeFieldOperationalSummary,
  overallProgressNotComplete,
} from '@/modules/field-operations/field-mobile/engine/field-progress'
import { logoutWarningRequired } from '@/modules/field-operations/field-mobile/engine/field-mobile-storage'
import { simulateBundleSync } from '@/modules/field-operations/field-mobile/engine/field-sync-simulator'
import {
  buildSyntheticFieldPackageRecord,
  SYNTHETIC_PACKAGE_ID,
  SYNTHETIC_TASK_OBS,
} from '@/modules/field-operations/field-mobile/fixtures/field-mobile-fixtures'
import { labelConnectivity, labelSyncStatus, t } from '@/modules/field-operations/field-mobile/i18n/field-mobile-i18n'
import { runMockSyncDirect } from '@/modules/field-operations/field-mobile/hooks/useFieldMobileSync'
import { createMockSyncTransport } from '@/modules/field-operations/field-sync/api/field-sync-mock-transport'
import { syncBundle } from '@/modules/field-operations/field-sync/engine/field-sync.orchestrator'
import { FieldSyncRepository } from '@/modules/field-operations/field-sync/field-sync.repository'
import {
  assertCaptureAllowed,
  buildAndFinalizeTaskBundle,
  buildGeoLocation,
  captureContextFromPackage,
  capturePhotoEvidence,
  createStructuredEvidenceFromForm,
} from '@/modules/field-operations/offline-evidence/engine/offline-evidence-capture'
import { OfflineEvidenceRepository } from '@/modules/field-operations/offline-evidence/offline-evidence.repository'
import type { LocalEvidenceBundle } from '@/modules/field-operations/offline-evidence/offline-evidence.types'
import { buildFieldFormOutput } from '@/modules/field-operations/field-forms/engine/field-form-output'
import {
  createFieldFormRuntime,
  finalizeForm,
  openTaskForm,
  saveDraft,
} from '@/modules/field-operations/field-forms/field-form.runtime'
import { parsePackageTasks } from '@/modules/field-operations/field-forms/engine/package-compatibility'
import { FieldFormRepository } from '@/modules/field-operations/field-forms/field-form.repository'
import { OfflinePackageRepository } from '@/modules/field-operations/offline-packages/offline-package.repository'

const EVALUATED_AT = '2026-07-10T12:00:00.000Z'

function photoBytes(label: string): Uint8Array {
  return new TextEncoder().encode(`synthetic-jpeg-${label}`)
}

function obsFormOutput() {
  return buildFieldFormOutput({
    response_id: '00000000-0000-4000-a00e-000000000301',
    mission_id: '00000000-0000-4000-a00e-000000000001',
    task_id: SYNTHETIC_TASK_OBS,
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
    package_id: SYNTHETIC_PACKAGE_ID,
  })
}

describe('field mobile experience — 8B.7E', () => {
  it('freezes fire-field-mobile model v1.0.0', () => {
    expect(FIRE_FIELD_MOBILE_MODEL_VERSION).toBe('1.0.0')
  })

  it('blocks real sync until 8B.7F', () => {
    expect(FIELD_REAL_SYNC_ENABLED).toBe(false)
  })

  it('translates internal statuses to ES and EN', () => {
    expect(labelSyncStatus('pending_sync', 'es')).toBe('Listo para sincronizar')
    expect(labelSyncStatus('pending_sync', 'en')).toBe('Ready to sync')
    expect(t('saved_on_device', 'en')).toBe('Saved on this device')
  })

  it('probes connectivity beyond navigator.onLine', async () => {
    const offline = await probeFieldConnectivity({ forceOffline: true })
    expect(offline.state).toBe('offline')
    expect(offline.navigator_online).toBe(false)

    const session = await probeFieldConnectivity({ sessionExpired: true })
    expect(session.state).toBe('session_expired')

    const slow = await probeFieldConnectivity({
      ignoreNavigator: true,
      fetchFn: async () => {
        await new Promise((r) => setTimeout(r, 10))
        return new Response('ok', { status: 200 })
      },
    })
    expect(['sync_available', 'slow_network', 'online_no_api']).toContain(slow.state)
    expect(labelConnectivity('online_no_api', 'es')).toBe('Sin servidor disponible')
  })

  it('does not show 100% synced while work remains local only', () => {
    const summary = computeFieldOperationalSummary({
      packages: [buildSyntheticFieldPackageRecord()],
      taskProgress: [
        {
          task_id: SYNTHETIC_TASK_OBS,
          status: 'complete',
          schema_id: 'field_visual_observation',
          response_id: 'r1',
        },
      ],
      pendingSyncBundles: [
        {
          bundle_id: 'b1',
          status: 'pending_sync',
        } as LocalEvidenceBundle,
      ],
      syncSessions: [],
      conflicts: [],
      localStorageBytes: 1024,
      connectivity: 'offline',
      now_iso: EVALUATED_AT,
    })
    expect(summary.synced_pct).toBeLessThan(100)
    expect(overallProgressNotComplete(summary)).toBe(true)
  })

  it('protects pending_sync bundles from cleanup', () => {
    expect(assertCleanupAllowed(['synced']).ok).toBe(true)
    expect(assertCleanupAllowed(['pending_sync']).ok).toBe(false)
  })

  it('warns on logout when pending evidence exists', () => {
    expect(logoutWarningRequired(1, 0)).toBe(true)
    expect(logoutWarningRequired(0, 0)).toBe(false)
  })

  it('blocks new capture on revoked package but keeps local records', async () => {
    const evidenceRepo = OfflineEvidenceRepository.createInMemory()
    const pkg = buildSyntheticFieldPackageRecord()
    pkg.local_status = 'revoked'
    const ctx = captureContextFromPackage(pkg, SYNTHETIC_TASK_OBS, 'tab-a', EVALUATED_AT)
    expect(assertCaptureAllowed(ctx).ok).toBe(false)
    await evidenceRepo.saveRecord({
      local_evidence_id: 'e-local',
      package_id: pkg.package_id,
      package_version: 1,
      mission_id: pkg.mission_id,
      task_id: SYNTHETIC_TASK_OBS,
      requirement_ids: [],
      verification_need_ids: [],
      form_response_id: null,
      evidence_type: 'structured_observation',
      status: 'ready',
      captured_at: EVALUATED_AT,
      device_timestamp: EVALUATED_AT,
      created_at: EVALUATED_AT,
      updated_at: EVALUATED_AT,
      location: null,
      location_accuracy_m: null,
      source: 'form_output',
      metadata: {},
      limitations: [],
      checksum: 'abc',
      local_revision: 1,
      context_signature: 'ctx',
      privacy_classification: 'internal',
      structured_payload: { answers: {} },
      form_output_checksum: null,
      tab_id: 'tab-a',
    })
    expect(await evidenceRepo.getRecord('e-local')).toBeTruthy()
  })

  it('offers superseded package without deleting local bundles', async () => {
    const evidenceRepo = OfflineEvidenceRepository.createInMemory()
    const pkg = buildSyntheticFieldPackageRecord()
    pkg.local_status = 'superseded'
    pkg.superseded_by = '00000000-0000-4000-a00e-000000000999'
    await evidenceRepo.saveBundle({
      bundle_id: '00000000-0000-4000-a00e-000000000601',
      package_id: pkg.package_id,
      package_version: 1,
      mission_id: pkg.mission_id,
      task_id: SYNTHETIC_TASK_OBS,
      form_response_ids: [],
      evidence_record_ids: [],
      requirement_links: [],
      captured_at_range: { start: EVALUATED_AT, end: EVALUATED_AT },
      location_summary: {},
      limitations: [],
      bundle_checksum: 'chk',
      status: 'pending_sync',
      size_bytes: 100,
      supersedes_bundle_id: null,
      created_at: EVALUATED_AT,
      updated_at: EVALUATED_AT,
      tab_id: 'tab-a',
    })
    expect(await evidenceRepo.getBundle('00000000-0000-4000-a00e-000000000601')).toBeTruthy()
    expect(assertCaptureAllowed(captureContextFromPackage(pkg, SYNTHETIC_TASK_OBS, 'tab-a', EVALUATED_AT)).ok).toBe(
      false,
    )
  })

  it('simulates conflict scenarios without deleting local evidence', async () => {
    const evidenceRepo = OfflineEvidenceRepository.createInMemory()
    const pkg = buildSyntheticFieldPackageRecord()
    await createStructuredEvidenceFromForm({
      repo: evidenceRepo,
      ctx: captureContextFromPackage(pkg, SYNTHETIC_TASK_OBS, 'tab-a', EVALUATED_AT),
      output: obsFormOutput(),
      pkg_payloads: pkg.payloads,
    })
    const { bundle } = await buildAndFinalizeTaskBundle({
      repo: evidenceRepo,
      pkg,
      task_id: SYNTHETIC_TASK_OBS,
      allow_limitations: true,
      tab_id: 'tab-a',
    })

    for (const scenario of ['mission_cancelled', 'package_revoked', 'network_interrupted'] as const) {
      const pending = { ...bundle, status: 'pending_sync' as const }
      await evidenceRepo.saveBundle(pending)
      const result = await simulateBundleSync({
        bundle: pending,
        pkg,
        evidenceRepo,
        syncRepo: FieldSyncRepository.createInMemory(),
        conflictScenario: scenario,
      })
      expect(result.ok).toBe(false)
      expect(await evidenceRepo.getRecord(bundle.evidence_record_ids[0]!)).toBeTruthy()
    }
  })

  it('simulates checksum mismatch without deleting local evidence', async () => {
    const evidenceRepo = OfflineEvidenceRepository.createInMemory()
    const syncRepo = FieldSyncRepository.createInMemory()
    const pkg = buildSyntheticFieldPackageRecord()
    await capturePhotoEvidence({
      repo: evidenceRepo,
      ctx: captureContextFromPackage(pkg, SYNTHETIC_TASK_OBS, 'tab-a', EVALUATED_AT),
      pkg_payloads: pkg.payloads,
      bytes: photoBytes('chk'),
      mime_type: 'image/jpeg',
      filename: 'chk.jpg',
    })
    const { bundle } = await buildAndFinalizeTaskBundle({
      repo: evidenceRepo,
      pkg,
      task_id: SYNTHETIC_TASK_OBS,
      allow_limitations: true,
      tab_id: 'tab-a',
    })
    const transport = createMockSyncTransport({ checksum_mismatch_on_confirm: true })
    const result = await syncBundle({
      bundle,
      pkg,
      evidenceRepo,
      syncRepo,
      transport,
      tab_id: 'tab-chk',
    })
    expect(result.ok).toBe(false)
    expect(await evidenceRepo.listRecordsForTask(pkg.package_id, SYNTHETIC_TASK_OBS)).not.toHaveLength(0)
  })

  it('PWA service worker preserves IndexedDB (shell cache only)', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const sw = await fs.readFile(path.join(process.cwd(), 'public/sw-field-campo.js'), 'utf8')
    expect(sw).not.toMatch(/indexedDB\.delete/)
    expect(sw).not.toMatch(/deleteDatabase/)
  })

  it('runs mock E2E: download → offline work → restart → sync interrupt → resume → zero duplicates', async () => {
    const packageRepo = OfflinePackageRepository.createInMemory()
    const evidenceRepo = OfflineEvidenceRepository.createInMemory()
    const syncRepo = FieldSyncRepository.createInMemory()
    const formRepo = FieldFormRepository.createInMemory()

    // 1–2. Install synthetic package (PWA open + download)
    const record = buildSyntheticFieldPackageRecord()
    await packageRepo.saveDownload({
      mission_id: record.mission_id,
      mission_title: record.mission_title,
      manifest: record.manifest,
      payloads: record.payloads,
      signingKey: 'synthetic-mobile-key',
    })

    // 3. Offline
    expect((await probeFieldConnectivity({ forceOffline: true })).state).toBe('offline')

    // 4. Open mission / package
    const pkg = await packageRepo.read(SYNTHETIC_PACKAGE_ID)
    expect(pkg?.mission_title).toContain('synthetic-field-mobile-fixture')
    const tasks = parsePackageTasks(pkg!)
    const obsTask = tasks.find((t) => String(t.id) === SYNTHETIC_TASK_OBS)!
    expect(obsTask).toBeTruthy()

    // 5. Complete form offline (draft then finalize)
    const runtime = createFieldFormRuntime(pkg!, formRepo)
    const opened = await openTaskForm(runtime, obsTask as Record<string, unknown>, EVALUATED_AT)
    expect(opened.ok).toBe(true)
    await saveDraft(runtime, opened.response!, { notes: 'borrador campo' }, EVALUATED_AT)
    const finalized = await finalizeForm(
      runtime,
      opened.response!,
      obsFormOutput().answers,
      EVALUATED_AT,
      { allowLimitations: true },
    )
    expect(finalized.ok).toBe(true)

    // 6–7. Capture simulated assets + build bundle
    await createStructuredEvidenceFromForm({
      repo: evidenceRepo,
      ctx: captureContextFromPackage(pkg!, SYNTHETIC_TASK_OBS, runtime.tabId, EVALUATED_AT),
      output: obsFormOutput(),
      pkg_payloads: pkg!.payloads,
    })
    await capturePhotoEvidence({
      repo: evidenceRepo,
      ctx: captureContextFromPackage(pkg!, SYNTHETIC_TASK_OBS, runtime.tabId, EVALUATED_AT),
      pkg_payloads: pkg!.payloads,
      bytes: photoBytes('campo-1'),
      filename: 'campo.jpg',
      mime_type: 'image/jpeg',
      location: buildGeoLocation({
        lat: 14.6,
        lng: -90.5,
        accuracy_m: 8,
        permission: 'granted',
        now_iso: EVALUATED_AT,
      }),
    })
    const { bundle } = await buildAndFinalizeTaskBundle({
      repo: evidenceRepo,
      pkg: pkg!,
      task_id: SYNTHETIC_TASK_OBS,
      allow_limitations: true,
      tab_id: runtime.tabId,
    })
    expect(bundle.status).toBe('pending_sync')

    // 8–9. App restart — re-read persisted local state
    const bundleAfterRestart = await evidenceRepo.getBundle(bundle.bundle_id)
    expect(bundleAfterRestart?.status).toBe('pending_sync')
    const draftResponses = await formRepo.listResponsesForTask(SYNTHETIC_PACKAGE_ID, SYNTHETIC_TASK_OBS)
    expect(draftResponses.length).toBeGreaterThan(0)

    // 10. Reconnect
    expect(
      (
        await probeFieldConnectivity({
          ignoreNavigator: true,
          fetchFn: async () => new Response('ok', { status: 200 }),
        })
      ).api_reachable,
    ).toBe(true)

    // 11–13. Simulated sync with interrupt + resume
    const interrupted = await simulateBundleSync({
      bundle: bundleAfterRestart!,
      pkg: pkg!,
      evidenceRepo,
      syncRepo,
      interruptAfterBytes: 4,
    })
    expect(interrupted.steps.some((s) => s.message_key === 'network_interrupted' || s.message_key === 'uploading_file')).toBe(
      true,
    )

    // Reset bundle to pending for full sync path if simulator marked synced
    const refreshed = await evidenceRepo.getBundle(bundle.bundle_id)
    const toSync = refreshed?.status === 'synced' ? { ...refreshed, status: 'pending_sync' as const } : refreshed!
    if (refreshed?.status === 'synced') await evidenceRepo.saveBundle(toSync)

    const transport = createMockSyncTransport()
    const completed = await syncBundle({
      bundle: toSync,
      pkg: pkg!,
      evidenceRepo,
      syncRepo,
      transport,
      tab_id: 'e2e-tab',
    })
    expect(completed.ok).toBe(true)

    // 14–15. Reconciliation + zero duplicates on replay
    const mock = transport as ReturnType<typeof createMockSyncTransport> & { _submissions: Map<string, unknown> }
    const countBefore = mock._submissions.size
    const replayBundle = { ...toSync, status: 'pending_sync' as const }
    await evidenceRepo.saveBundle(replayBundle)
    await syncBundle({
      bundle: replayBundle,
      pkg: pkg!,
      evidenceRepo,
      syncRepo,
      transport,
      tab_id: 'e2e-tab-replay',
    })
    expect(mock._submissions.size).toBe(countBefore)

    await expect(
      runMockSyncDirect(replayBundle, pkg!, { evidence: evidenceRepo, sync: syncRepo }),
    ).resolves.toBeDefined()
  })

  it('low storage warning does not imply pending_sync deletion', async () => {
    const evidenceRepo = OfflineEvidenceRepository.createInMemory()
    await evidenceRepo.putBlob('big', new Uint8Array(LOW_STORAGE_WARNING_BYTES + 512))
    const summary = computeFieldOperationalSummary({
      packages: [],
      taskProgress: [],
      pendingSyncBundles: [{ bundle_id: 'b', status: 'pending_sync' } as LocalEvidenceBundle],
      syncSessions: [],
      conflicts: [],
      localStorageBytes: LOW_STORAGE_WARNING_BYTES + 1024,
      connectivity: 'offline',
      now_iso: EVALUATED_AT,
    })
    expect(summary.blocked_reason).toContain('Poco espacio')
    expect(assertCleanupAllowed(['pending_sync']).ok).toBe(false)
  })
})
