import { LOW_STORAGE_WARNING_BYTES } from '@/modules/field-operations/field-mobile/config/fire-field-mobile.config'
import { t } from '@/modules/field-operations/field-mobile/i18n/field-mobile-i18n'
import type { FieldConnectivityState, FieldOperationalSummary } from '@/modules/field-operations/field-mobile/field-mobile.types'
import type { LocalEvidenceBundle } from '@/modules/field-operations/offline-evidence/offline-evidence.types'
import type { LocalTaskProgress } from '@/modules/field-operations/field-forms/field-form.types'
import type { LocalOfflinePackageRecord } from '@/modules/field-operations/offline-packages/offline-package.repository'
import type { SyncConflict, SyncSession } from '@/modules/field-operations/field-sync/field-sync.types'
import { canStartFieldExecution } from '@/modules/field-operations/offline-packages/offline-package.repository'

export function computeFieldOperationalSummary(input: {
  packages: LocalOfflinePackageRecord[]
  taskProgress: LocalTaskProgress[]
  pendingSyncBundles: LocalEvidenceBundle[]
  syncSessions: SyncSession[]
  conflicts: SyncConflict[]
  localStorageBytes: number
  connectivity: FieldConnectivityState
  now_iso: string
}): FieldOperationalSummary {
  const executable = input.packages.filter((p) => canStartFieldExecution(p, input.now_iso))
  const active = executable[0] ?? input.packages[0] ?? null

  const pendingTasks = input.taskProgress.filter((t) =>
    ['not_started', 'draft', 'blocked'].includes(t.status),
  ).length
  const draftForms = input.taskProgress.filter((t) => t.status === 'draft').length
  const completedTasks = input.taskProgress.filter((t) =>
    ['complete', 'complete_with_limitations'].includes(t.status),
  ).length
  const totalTasks = input.taskProgress.length || 1

  const syncedSessions = input.syncSessions.filter((s) => s.status === 'synced')
  const pausedOrFailed = input.syncSessions.filter((s) =>
    ['retry_scheduled', 'remote_rejected', 'conflict', 'partially_synced'].includes(s.status) ||
    s.paused,
  )

  const capturePct = Math.round((completedTasks / totalTasks) * 100)
  const readyPct =
    input.pendingSyncBundles.length > 0
      ? Math.min(99, Math.round((input.pendingSyncBundles.length / Math.max(1, executable.length)) * 100))
      : 0
  const syncedPct = syncedSessions.length > 0 ? Math.min(99, 50 + syncedSessions.length * 10) : 0

  let nextAction = t('continue_task', 'es')
  let blocked: string | null = null

  if (input.connectivity === 'offline') nextAction = t('saved_on_device', 'es')
  if (draftForms > 0) nextAction = t('continue_task', 'es')
  else if (input.pendingSyncBundles.length > 0) nextAction = t('prepare_sync', 'es')
  else if (pendingTasks > 0) nextAction = t('continue_task', 'es')

  if (input.packages.some((p) => p.local_status === 'revoked')) {
    blocked = t('package_revoked', 'es')
  }
  if (input.localStorageBytes > LOW_STORAGE_WARNING_BYTES) {
    blocked = blocked ? `${blocked}; ${t('low_storage', 'es')}` : t('low_storage', 'es')
  }

  return {
    active_package_id: active?.package_id ?? null,
    active_mission_title: active?.mission_title ?? null,
    packages_count: input.packages.length,
    pending_tasks: pendingTasks,
    draft_forms: draftForms,
    incomplete_evidence_requirements: input.pendingSyncBundles.length,
    pending_sync_bundles: input.pendingSyncBundles.length,
    paused_or_failed_sessions: pausedOrFailed.length,
    open_conflicts: input.conflicts.filter((c) => !c.resolved).length,
    local_storage_bytes: input.localStorageBytes,
    last_sync_at:
      syncedSessions.sort((a, b) => Date.parse(b.completed_at ?? b.updated_at) - Date.parse(a.completed_at ?? a.updated_at))[0]
        ?.completed_at ?? null,
    connectivity: input.connectivity,
    overall_capture_pct: capturePct,
    ready_for_sync_pct: readyPct,
    synced_pct: syncedPct,
    next_action: nextAction,
    blocked_reason: blocked,
  }
}

export function assertCleanupAllowed(bundleStatuses: string[]): { ok: boolean; reason?: string } {
  if (bundleStatuses.some((s) => s === 'pending_sync')) {
    return { ok: false, reason: 'cleanup_blocked_pending_sync' }
  }
  return { ok: true }
}

export function overallProgressNotComplete(summary: FieldOperationalSummary): boolean {
  if (summary.pending_sync_bundles > 0 && summary.synced_pct < 100) return true
  if (summary.overall_capture_pct < 100) return true
  return false
}
