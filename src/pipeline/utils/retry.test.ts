import { describe, expect, it } from 'vitest'
import { FirmsApiError } from '@/pipeline/connectors/firms.connector'
import { isTransientError, isTransientFirmsError } from '@/pipeline/utils/retry'

describe('pipeline retry policy', () => {
  it('retries network and timeout FIRMS errors', () => {
    expect(isTransientFirmsError(new FirmsApiError('TIMEOUT', 'timeout'))).toBe(true)
    expect(isTransientFirmsError(new FirmsApiError('NETWORK', 'network'))).toBe(true)
    expect(
      isTransientFirmsError(new FirmsApiError('HTTP_ERROR', 'server', 503)),
    ).toBe(true)
  })

  it('does not retry credential or validation errors', () => {
    expect(isTransientFirmsError(new FirmsApiError('UNCONFIGURED', 'no key'))).toBe(false)
    expect(isTransientFirmsError(new FirmsApiError('INVALID_KEY', 'bad key', 401))).toBe(false)
    expect(
      isTransientFirmsError(new FirmsApiError('HTTP_ERROR', 'client', 400)),
    ).toBe(false)
  })

  it('detects generic transient fetch failures', () => {
    expect(isTransientError(new Error('fetch failed'))).toBe(true)
  })
})
