/**
 * Integration test for the generic Environmental Event LIST route.
 *
 * Regression guard for the "map shows 0 while the KPI shows 13" bug: the map
 * used `limit: 500`, which the route rejects with HTTP 400 (cap is 1–100), so
 * every map request failed and the map/auto-selection/panel received nothing.
 *
 * Boots the REAL route handler + REAL auth guard; only the DB-backed service is
 * stubbed so the test never touches Supabase.
 */
import { IncomingMessage, type ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.AUTH_TEST_MODE = '1'
process.env.AUTH_ENFORCE = 'true'

const listMock = vi.fn()

vi.mock('../services/environmental-events.service.js', async (importActual) => {
  const actual =
    await importActual<typeof import('../services/environmental-events.service.js')>()
  return {
    ...actual,
    listEnvironmentalEvents: (...args: unknown[]) => listMock(...args),
  }
})

import { ensureEventsRegistered } from '@/modules/environmental-events/registry/register-all'
import { handleEnvironmentalEventsRoutes } from './environmental-events.js'

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

async function callList(qs: string, authHeader?: string) {
  const req = mockReq(authHeader)
  const res = mockRes()
  const handled = await handleEnvironmentalEventsRoutes(
    req,
    res,
    '/api/environmental-events',
    new URLSearchParams(qs),
  )
  return { handled, res }
}

const ADMIN = 'Bearer test-org-admin-org-a'

describe('GET /api/environmental-events (list) — window/limit contract', () => {
  beforeAll(() => {
    ensureEventsRegistered()
  })

  beforeEach(() => {
    process.env.AUTH_TEST_MODE = '1'
    process.env.AUTH_ENFORCE = 'true'
    listMock.mockReset()
  })

  it('rejects limit above the 100 cap with 400 (the map used limit=500)', async () => {
    const { handled, res } = await callList('type=thermal_activity&limit=500', ADMIN)
    expect(handled).toBe(true)
    expect(res.statusCode).toBe(400)
    expect(listMock).not.toHaveBeenCalled()
  })

  it('accepts the canonical map query (since + limit<=100) and returns its items', async () => {
    const items = Array.from({ length: 13 }, (_, i) => ({
      id: `evt-${i}`,
      eventType: 'thermal_activity',
      geometry: { type: 'Point', coordinates: [-90.5 - i * 0.05, 15.5 + i * 0.05] },
    }))
    listMock.mockResolvedValue({
      items,
      pagination: { page: 1, limit: 100, total: 13 },
      generatedAt: new Date().toISOString(),
    })

    const since = new Date(Date.now() - 48 * 3_600_000).toISOString()
    const { handled, res } = await callList(
      `type=thermal_activity&since=${encodeURIComponent(since)}&limit=100`,
      ADMIN,
    )

    expect(handled).toBe(true)
    expect(res.statusCode).toBe(200)
    const body = res.json() as { items: unknown[] }
    expect(body.items).toHaveLength(13)

    // The list query forwarded to the service must carry the window and NOT a
    // narrowing fire `status`, so it matches the KPI's 48h window count.
    expect(listMock).toHaveBeenCalledTimes(1)
    const passed = listMock.mock.calls[0][0] as {
      type?: string
      since?: string
      status?: string
      limit?: number
    }
    expect(passed.type).toBe('thermal_activity')
    expect(passed.since).toBe(since)
    expect(passed.status).toBeUndefined()
    expect(passed.limit).toBe(100)
  })
})
