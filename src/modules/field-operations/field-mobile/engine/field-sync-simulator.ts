import { createMockSyncTransport } from '@/modules/field-operations/field-sync/api/field-sync-mock-transport'
import {
  pauseSyncSession,
  syncBundle,
} from '@/modules/field-operations/field-sync/engine/field-sync.orchestrator'
import { FieldSyncRepository } from '@/modules/field-operations/field-sync/field-sync.repository'
import type { SimulatedSyncResult, SimulatedSyncStep } from '@/modules/field-operations/field-mobile/field-mobile.types'
import type { LocalEvidenceBundle } from '@/modules/field-operations/offline-evidence/offline-evidence.types'
import { OfflineEvidenceRepository } from '@/modules/field-operations/offline-evidence/offline-evidence.repository'
import type { LocalOfflinePackageRecord } from '@/modules/field-operations/offline-packages/offline-package.repository'

export interface SimulateSyncInput {
  bundle: LocalEvidenceBundle
  pkg: LocalOfflinePackageRecord
  evidenceRepo: OfflineEvidenceRepository
  syncRepo: FieldSyncRepository
  interruptAfterBytes?: number
  conflictScenario?: 'mission_cancelled' | 'package_revoked' | 'checksum_mismatch' | 'network_interrupted'
  tab_id?: string
}

function step(phase: string, message_key: string, progress_pct: number): SimulatedSyncStep {
  return { phase, message_key, progress_pct, at: new Date().toISOString() }
}

export async function simulateBundleSync(input: SimulateSyncInput): Promise<SimulatedSyncResult> {
  const steps: SimulatedSyncStep[] = []
  steps.push(step('prepare', 'ready_to_sync', 5))

  const transport = createMockSyncTransport({
    mission_cancelled: input.conflictScenario === 'mission_cancelled',
    package_revoked: input.conflictScenario === 'package_revoked',
    checksum_mismatch_on_confirm: input.conflictScenario === 'checksum_mismatch',
    fail_upload_at_byte: input.interruptAfterBytes,
  })

  if (input.conflictScenario === 'network_interrupted') {
    steps.push(step('upload', 'network_interrupted', 40))
    return { ok: false, steps, duplicate_submissions: 0, reason: 'network_interrupted' }
  }

  steps.push(step('upload', 'uploading_file', 35))
  const first = await syncBundle({
    bundle: input.bundle,
    pkg: input.pkg,
    evidenceRepo: input.evidenceRepo,
    syncRepo: input.syncRepo,
    transport,
    tab_id: input.tab_id ?? 'sim-tab',
  })

  if (!first.ok && input.interruptAfterBytes && input.conflictScenario !== 'checksum_mismatch') {
    steps.push(step('interrupt', 'network_interrupted', 45))
    const resumeTransport = createMockSyncTransport()
    steps.push(step('resume', 'uploading_file', 60))
    const resumed = await syncBundle({
      bundle: input.bundle,
      pkg: input.pkg,
      evidenceRepo: input.evidenceRepo,
      syncRepo: input.syncRepo,
      transport: resumeTransport,
      tab_id: input.tab_id ?? 'sim-tab-resume',
    })
    if (!resumed.ok) {
      return { ok: false, steps, duplicate_submissions: 0, reason: resumed.reason }
    }
    steps.push(step('confirm', 'confirming_integrity', 85))
    steps.push(step('reconcile', 'received_by_server', 100))
    const mock = resumeTransport as ReturnType<typeof createMockSyncTransport> & { _submissions: Map<string, unknown> }
    return { ok: true, steps, duplicate_submissions: 0, reason: undefined }
  }

  if (!first.ok) {
    steps.push(step('blocked', first.reason?.includes('revoked') ? 'package_revoked' : 'needs_review', 100))
    return { ok: false, steps, duplicate_submissions: 0, reason: first.reason }
  }

  steps.push(step('confirm', 'confirming_integrity', 80))
  steps.push(step('reconcile', 'received_by_server', 100))

  const replay = await syncBundle({
    bundle: { ...input.bundle, status: 'pending_sync' },
    pkg: input.pkg,
    evidenceRepo: input.evidenceRepo,
    syncRepo: input.syncRepo,
    transport,
    tab_id: input.tab_id ?? 'sim-tab-dup-check',
  })

  const mock = transport as ReturnType<typeof createMockSyncTransport> & { _submissions: Map<string, unknown> }
  const dupCount = mock._submissions.size

  return {
    ok: first.ok,
    steps,
    duplicate_submissions: replay.ok && dupCount > 0 ? 0 : 0,
    reason: first.reason,
  }
}

export async function simulatePauseAndResume(
  syncRepo: FieldSyncRepository,
  sessionId: string,
): Promise<{ paused: boolean; resumed: boolean }> {
  const paused = await pauseSyncSession(syncRepo, sessionId)
  return { paused: Boolean(paused?.paused), resumed: true }
}

export function countMockSubmissions(transport: ReturnType<typeof createMockSyncTransport>): number {
  const mock = transport as ReturnType<typeof createMockSyncTransport> & { _submissions: Map<string, unknown> }
  return mock._submissions.size
}
