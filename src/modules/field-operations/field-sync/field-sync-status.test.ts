import { describe, expect, it } from 'vitest'

import {
  resolveFieldSyncStatus,
  type FieldSyncSignals,
} from '@/modules/field-operations/field-sync/field-sync-status'

const base: FieldSyncSignals = {
  featureEnabled: true,
  authenticated: true,
  organizationEligible: true,
  online: true,
  hasPendingWork: false,
  syncRunning: false,
  hasError: false,
}

describe('Field Sync presentation state machine', () => {
  it('shows a single canonical state for every input', () => {
    const status = resolveFieldSyncStatus(base)
    expect(status.state).toBe('available')
    expect(status.label).toBe('Sincronización disponible')
  })

  it('feature/eligibility gate wins over everything else', () => {
    expect(resolveFieldSyncStatus({ ...base, featureEnabled: false }).state).toBe('not_enabled')
    expect(resolveFieldSyncStatus({ ...base, authenticated: false }).state).toBe('not_enabled')
    expect(resolveFieldSyncStatus({ ...base, organizationEligible: false }).state).toBe('not_enabled')
  })

  it('never contradicts: offline + pending resolves to a single state', () => {
    const status = resolveFieldSyncStatus({ ...base, online: false, hasPendingWork: true })
    expect(status.state).toBe('offline')
    expect(status.label).toBe('Sin conexión suficiente para sincronizar')
  })

  it('error takes precedence over running/offline/pending', () => {
    const status = resolveFieldSyncStatus({
      ...base,
      hasError: true,
      syncRunning: true,
      online: false,
      hasPendingWork: true,
    })
    expect(status.state).toBe('error')
  })

  it('running takes precedence over offline and pending', () => {
    const status = resolveFieldSyncStatus({
      ...base,
      syncRunning: true,
      online: false,
      hasPendingWork: true,
    })
    expect(status.state).toBe('running')
  })

  it('pending shows when online, enabled, not running and no error', () => {
    const status = resolveFieldSyncStatus({ ...base, hasPendingWork: true })
    expect(status.state).toBe('pending')
    expect(status.label).toBe('Trabajo pendiente de sincronización')
  })

  it('maps every state to a unique Spanish label', () => {
    const labels = new Set(
      [
        resolveFieldSyncStatus({ ...base, featureEnabled: false }),
        resolveFieldSyncStatus({ ...base, hasError: true }),
        resolveFieldSyncStatus({ ...base, syncRunning: true }),
        resolveFieldSyncStatus({ ...base, online: false }),
        resolveFieldSyncStatus({ ...base, hasPendingWork: true }),
        resolveFieldSyncStatus(base),
      ].map((s) => s.label),
    )
    expect(labels.size).toBe(6)
    for (const label of labels) {
      expect(label).not.toMatch(/[a-z]+_[a-z]+/) // no raw snake_case tokens
    }
  })
})
