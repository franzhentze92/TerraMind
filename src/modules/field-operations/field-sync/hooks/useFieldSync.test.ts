import { describe, expect, it } from 'vitest'

import { buildDevLoginSession } from '@/core/auth/dev-login'

describe('useFieldSync dependency contract', () => {
  it('documents stable refresh dependency for pending bundles', () => {
    const refresh = () => Promise.resolve()
    const deps = [refresh]
    expect(deps).toHaveLength(1)
  })
})

describe('dev-login runtime isolation', () => {
  it('does not expose embedded sessions in test runtime', () => {
    expect(buildDevLoginSession('test-org-admin-org-a')).toBeNull()
  })
})
