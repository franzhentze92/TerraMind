import { describe, expect, it } from 'vitest'
import { GbifApiError } from './gbif.types'

describe('gbif.client errors', () => {
  it('GbifApiError exposes code and status', () => {
    const err = new GbifApiError('RATE_LIMIT', 'throttled', 429)
    expect(err.code).toBe('RATE_LIMIT')
    expect(err.status).toBe(429)
  })

  it('treats 429 as rate limit code', () => {
    const err = new GbifApiError('RATE_LIMIT', 'throttled', 429)
    expect(err.name).toBe('GbifApiError')
  })
})
