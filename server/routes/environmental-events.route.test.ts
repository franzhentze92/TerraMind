/**
 * Integration test for the generic Environmental Event routes.
 *
 * This boots the REAL route handler + REAL operational auth guard (only the
 * DB-backed per-type summaries service is stubbed, so the test never depends on
 * Supabase). It exists because a stale/misconfigured backend previously made
 * `/api/environmental-events/types` 404 while unit tests stayed green — the gap
 * was that nothing exercised the actual route + the exact path the frontend
 * calls.
 */
import { IncomingMessage, type ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Auth in enforced test mode so `test-*` bearer tokens resolve.
process.env.AUTH_TEST_MODE = '1'
process.env.AUTH_ENFORCE = 'true'

// Stub only the DB-backed summaries so the 200 path does not touch Supabase.
vi.mock('../services/environmental-events.service.js', async (importActual) => {
  const actual =
    await importActual<typeof import('../services/environmental-events.service.js')>()
  return {
    ...actual,
    getEnvironmentalEventTypeSummaries: vi.fn(async () => [
      {
        type: 'thermal_activity',
        label: 'Actividad térmica',
        activeCount: 3,
        newCount: 1,
        status: 'active' as const,
      },
    ]),
  }
})

import { ensureEventsRegistered } from '@/modules/environmental-events/registry/register-all'
import { handleEnvironmentalEventsRoutes } from './environmental-events.js'

const RAINFALL_FLAG = 'EVENT_FLAG_RAINFALL_DEFICIT'

function mockReq(authHeader?: string): IncomingMessage {
  const socket = new Socket()
  const req = new IncomingMessage(socket)
  req.method = 'GET'
  if (authHeader) req.headers.authorization = authHeader
  return req
}

interface CapturedRes {
  statusCode: number
  headers: Record<string, string>
  body: string
  json: () => unknown
}

function mockRes(): ServerResponse & CapturedRes {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: '',
    setHeader(key: string, value: string) {
      this.headers[key.toLowerCase()] = String(value)
      return this
    },
    writeHead(status: number, headers?: Record<string, string>) {
      this.statusCode = status
      if (headers) {
        for (const [k, v] of Object.entries(headers)) this.headers[k.toLowerCase()] = String(v)
      }
      return this
    },
    end(chunk?: string) {
      if (chunk) this.body += chunk
      return this
    },
    json() {
      return JSON.parse(this.body)
    },
  }
  return res as unknown as ServerResponse & CapturedRes
}

async function callTypes(authHeader?: string) {
  const req = mockReq(authHeader)
  const res = mockRes()
  const handled = await handleEnvironmentalEventsRoutes(
    req,
    res,
    '/api/environmental-events/types',
    new URLSearchParams(),
  )
  return { handled, res }
}

describe('GET /api/environmental-events/types (real router + auth)', () => {
  beforeAll(() => {
    ensureEventsRegistered()
  })

  beforeEach(() => {
    process.env.AUTH_TEST_MODE = '1'
    process.env.AUTH_ENFORCE = 'true'
    delete process.env[RAINFALL_FLAG]
  })

  it('rejects unauthenticated requests with 401 (route exists, not 404)', async () => {
    const { handled, res } = await callTypes()
    expect(handled).toBe(true)
    expect(res.statusCode).toBe(401)
    expect(res.json()).toMatchObject({ error: expect.any(String) })
  })

  it('rejects an authenticated user without incidents.view with 403', async () => {
    const { handled, res } = await callTypes('Bearer test-tech-org-a')
    expect(handled).toBe(true)
    expect(res.statusCode).toBe(403)
  })

  it('returns 200 JSON with items for an authorized user', async () => {
    const { handled, res } = await callTypes('Bearer test-org-admin-org-a')
    expect(handled).toBe(true)
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('application/json')
    const body = res.json() as {
      items: Array<{ type: string }>
      registered_types: string[]
      generated_at: string
    }
    expect(Array.isArray(body.items)).toBe(true)
    expect(typeof body.generated_at).toBe('string')
    expect(body.items.some((i) => i.type === 'thermal_activity')).toBe(true)
  })

  it('always exposes thermal_activity and hides rainfall_deficit when its flag is off', async () => {
    const { res } = await callTypes('Bearer test-org-admin-org-a')
    const body = res.json() as { registered_types: string[] }
    expect(body.registered_types).toContain('thermal_activity')
    expect(body.registered_types).not.toContain('rainfall_deficit')
  })

  it('exposes rainfall_deficit only when its runtime flag is enabled', async () => {
    process.env[RAINFALL_FLAG] = '1'
    const { res } = await callTypes('Bearer test-org-admin-org-a')
    const body = res.json() as { registered_types: string[] }
    expect(body.registered_types).toContain('rainfall_deficit')
    delete process.env[RAINFALL_FLAG]
  })

  it('does not claim to handle paths outside /api/environmental-events', async () => {
    const req = mockReq('Bearer test-org-admin-org-a')
    const res = mockRes()
    const handled = await handleEnvironmentalEventsRoutes(
      req,
      res,
      '/api/health',
      new URLSearchParams(),
    )
    expect(handled).toBe(false)
  })
})
