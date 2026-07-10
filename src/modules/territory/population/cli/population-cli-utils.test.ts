import { describe, expect, it } from 'vitest'

import {
  parseCliArgs,
  parseRadiiArg,
  requireNumberArg,
  sanitizeJsonForCli,
} from '@/modules/territory/population/cli/population-cli-utils'

describe('population CLI utils', () => {
  it('parses --key=value args', () => {
    const args = parseCliArgs(['--lat=14.5', '--lon=-90.5', '--validation=true'])
    expect(args.lat).toBe('14.5')
    expect(args.lon).toBe('-90.5')
    expect(args.validation).toBe('true')
  })

  it('parses radii list', () => {
    expect(parseRadiiArg('500,1000,3000')).toEqual([500, 1000, 3000])
  })

  it('requires numeric args', () => {
    expect(requireNumberArg({ lat: '14.2' }, 'lat')).toBe(14.2)
    expect(() => requireNumberArg({}, 'lat')).toThrow(/Falta argumento/)
  })

  it('redacts internal paths from JSON output', () => {
    const out = sanitizeJsonForCli({
      path: 'C:\\data\\population\\worldpop\\processed\\x.tif',
      ok: true,
    })
    expect(out.path).toBe('[redacted]')
    expect(out.ok).toBe(true)
  })
})
