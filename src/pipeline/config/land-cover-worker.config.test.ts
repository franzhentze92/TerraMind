import { describe, expect, it } from 'vitest'
import { retryBackoffMinutes } from '@/pipeline/config/land-cover-worker.config'

describe('land-cover worker config', () => {
  it('aplica backoff 5/15/60 minutos', () => {
    expect(retryBackoffMinutes(1)).toBe(5)
    expect(retryBackoffMinutes(2)).toBe(15)
    expect(retryBackoffMinutes(3)).toBe(60)
    expect(retryBackoffMinutes(9)).toBe(60)
  })
})
