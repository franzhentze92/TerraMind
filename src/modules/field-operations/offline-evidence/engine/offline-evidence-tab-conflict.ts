import type { LocalEvidenceRecord } from '@/modules/field-operations/offline-evidence/offline-evidence.types'

export function detectEvidenceTabConflict(
  records: LocalEvidenceRecord[],
  taskId: string,
  tabId: string,
): { conflict: boolean; reason?: string } {
  const active = records.find(
    (r) =>
      r.task_id === taskId &&
      r.status === 'capturing' &&
      r.tab_id &&
      r.tab_id !== tabId,
  )
  if (active) return { conflict: true, reason: 'local_tab_conflict' }
  return { conflict: false }
}

export async function assertNoTabConflict(
  records: LocalEvidenceRecord[],
  taskId: string,
  tabId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const check = detectEvidenceTabConflict(records, taskId, tabId)
  if (check.conflict) return { ok: false, reason: check.reason }
  return { ok: true }
}
