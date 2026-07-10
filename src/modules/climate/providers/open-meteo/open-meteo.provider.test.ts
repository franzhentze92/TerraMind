import { describe, expect, it } from 'vitest'
import { createClimateProvider } from './open-meteo.provider'

describe('createClimateProvider', () => {
  it('returns open_meteo provider by default', () => {
    const provider = createClimateProvider('open_meteo')
    expect(provider.id).toBe('open_meteo')
  })

  it('throws for unimplemented providers', () => {
    expect(() => createClimateProvider('insivumeh')).toThrow(/no implementado/)
  })
})
