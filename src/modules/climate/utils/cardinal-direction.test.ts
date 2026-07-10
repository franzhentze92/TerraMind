import { describe, expect, it } from 'vitest'
import { degreesToCardinal } from './cardinal-direction'

describe('degreesToCardinal', () => {
  it('maps cardinal and intercardinal directions', () => {
    expect(degreesToCardinal(0)).toBe('N')
    expect(degreesToCardinal(90)).toBe('E')
    expect(degreesToCardinal(180)).toBe('S')
    expect(degreesToCardinal(270)).toBe('W')
    expect(degreesToCardinal(45)).toBe('NE')
    expect(degreesToCardinal(337)).toBe('NNW')
  })

  it('returns null for invalid input', () => {
    expect(degreesToCardinal(null)).toBeNull()
    expect(degreesToCardinal(Number.NaN)).toBeNull()
  })
})
