/**
 * Runtime-robustness tests for Situación Nacional.
 *
 * Covers the two failures found during real frontend+backend review:
 *  1. `/api/environmental-events/types` path contract (frontend must call the
 *     same canonical route the backend serves).
 *  2. `buildNationalExecutiveSummary` crashing on a partial dashboard DTO
 *     (`Cannot read properties of undefined (reading 'length')`).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import type { ExecutiveDashboardDto } from '@/modules/executive-demo/types/executive-demo.types'
import { buildNationalExecutiveSummary } from './national-executive-summary'
import { normalizeNationalSituationDashboardDto } from './national-situation-dashboard.normalize'

function readSrc(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf8')
}

describe('canonical /api/environmental-events/types path contract', () => {
  it('frontend API client calls the /environmental-events/types endpoint', () => {
    const api = readSrc('src/modules/environmental-events/api/environmental-events.api.ts')
    expect(api).toContain('/environmental-events/types')
  })

  it('api client base url defaults to /api', () => {
    const client = readSrc('src/core/api/client.ts')
    expect(client).toContain("VITE_API_BASE_URL ?? '/api'")
  })

  it('backend route serves the exact /api/environmental-events/types path', () => {
    const route = readSrc('server/routes/environmental-events.ts')
    expect(route).toContain("'/api/environmental-events/types'")
  })
})

describe('normalizeNationalSituationDashboardDto', () => {
  it('returns undefined unchanged (loading/error stays distinguishable)', () => {
    expect(normalizeNationalSituationDashboardDto(undefined)).toBeUndefined()
  })

  it('coerces every missing collection to an array', () => {
    // A deliberately partial payload (the stale-backend shape).
    const partial = { generated_at: 'x', system_status: 'ok' } as unknown as ExecutiveDashboardDto
    const out = normalizeNationalSituationDashboardDto(partial)!
    expect(Array.isArray(out.top_priorities)).toBe(true)
    expect(Array.isArray(out.pending_decisions)).toBe(true)
    expect(Array.isArray(out.recent_changes)).toBe(true)
    expect(Array.isArray(out.metrics)).toBe(true)
    expect(out.top_priorities).toHaveLength(0)
  })

  it('preserves present values, including empty arrays and scalars', () => {
    const dto = {
      generated_at: '2026-01-01',
      system_status: 'ok',
      sources_active: 0,
      pending_decisions: [],
      top_priorities: [{ id: 'p1' }],
    } as unknown as ExecutiveDashboardDto
    const out = normalizeNationalSituationDashboardDto(dto)!
    expect(out.sources_active).toBe(0)
    expect(out.top_priorities).toHaveLength(1)
    expect(out.pending_decisions).toHaveLength(0)
  })
})

describe('buildNationalExecutiveSummary — partial data resilience', () => {
  it('does not throw on an undefined dashboard and empty metrics', () => {
    expect(() => buildNationalExecutiveSummary([], undefined, 48)).not.toThrow()
    const summary = buildNationalExecutiveSummary([], undefined, 48)
    expect(typeof summary.what_is_happening).toBe('string')
    expect(typeof summary.requires_attention).toBe('string')
  })

  it('does not throw when dashboard is present but its arrays are missing', () => {
    const partial = { generated_at: 'x', system_status: 'ok' } as unknown as ExecutiveDashboardDto
    expect(() => buildNationalExecutiveSummary([], partial, 48)).not.toThrow()
    const summary = buildNationalExecutiveSummary([], partial, 48)
    expect(summary.what_changed).toContain('No hay suficiente historial')
  })

  it('tolerates metrics that arrive as a non-array', () => {
    const notArray = undefined as unknown as never
    expect(() => buildNationalExecutiveSummary(notArray, undefined, 48)).not.toThrow()
  })
})
