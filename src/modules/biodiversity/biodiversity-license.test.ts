import { describe, expect, it } from 'vitest'
import { evaluateOccurrenceLicense } from './biodiversity-license'

describe('biodiversity-license', () => {
  it('warns on unknown license', () => {
    const result = evaluateOccurrenceLicense({ source: 'gbif' })
    expect(result.warnings).toContain('unknown_license')
    expect(result.attributionRequired).toBe(true)
  })

  it('warns when media present', () => {
    const result = evaluateOccurrenceLicense({
      source: 'inaturalist',
      license: 'CC-BY-4.0',
      hasMedia: true,
    })
    expect(result.warnings).toContain('media_license_not_verified')
  })

  it('normalizes CC license URLs', () => {
    const result = evaluateOccurrenceLicense({
      source: 'gbif',
      license: 'https://creativecommons.org/licenses/by/4.0/legalcode',
    })
    expect(result.license).toBe('CC-BY-4.0')
  })
})
