import type { LocalEvidenceBundle } from '@/modules/field-operations/offline-evidence/offline-evidence.types'
import type { LocalOfflinePackageRecord } from '@/modules/field-operations/offline-packages/offline-package.repository'

export interface SyncEligibilityInput {
  bundle: LocalEvidenceBundle
  pkg: LocalOfflinePackageRecord | null
  mission_status?: string | null
  assignment_active?: boolean
  permissions?: string[]
  now_iso: string
}

export interface SyncEligibilityResult {
  eligible: boolean
  reasons: string[]
  warnings: string[]
}

export function evaluateSyncEligibility(input: SyncEligibilityInput): SyncEligibilityResult {
  const reasons: string[] = []
  const warnings: string[] = []

  if (input.bundle.status !== 'pending_sync') {
    reasons.push(`bundle_status_${input.bundle.status}`)
  }
  if (!input.pkg) {
    reasons.push('package_not_found')
  } else if (input.pkg.local_status === 'revoked') {
    reasons.push('package_revoked')
  } else if (input.pkg.local_status === 'integrity_failed') {
    reasons.push('package_integrity_failed')
  } else if (input.pkg.local_status === 'superseded') {
    warnings.push('package_superseded')
  }

  if (input.mission_status === 'cancelled') {
    reasons.push('mission_cancelled')
  }
  if (input.assignment_active === false) {
    warnings.push('assignment_inactive')
  }
  if (input.permissions && !input.permissions.includes('evidence.submit')) {
    reasons.push('permission_denied')
  }
  if (input.bundle.evidence_record_ids.length === 0) {
    reasons.push('empty_bundle')
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    warnings,
  }
}
