import { describe, expect, it, beforeEach } from 'vitest'
import { IncomingMessage } from 'node:http'
import { Socket } from 'node:net'

import { resolveRequestAuth, extractBearerToken } from './resolve-auth-context.js'
import { authorizeMissionAccess } from '../services/authorization/mission-access.js'
import { authorizeFieldSyncAccess } from '../services/authorization/index.js'
import {
  TEST_MISSION_ORG_A,
  TEST_MISSION_ORG_B,
  TEST_ORG_A,
} from './test-fixtures.js'
import { AuthorizationError } from '@/core/auth/permissions.js'

process.env.AUTH_TEST_MODE = '1'
process.env.AUTH_ENFORCE = 'true'

function mockReq(authHeader?: string): IncomingMessage {
  const socket = new Socket()
  const req = new IncomingMessage(socket)
  if (authHeader) req.headers.authorization = authHeader
  return req
}

describe('auth middleware — 8B.7F', () => {
  beforeEach(() => {
    process.env.AUTH_TEST_MODE = '1'
    process.env.AUTH_ENFORCE = 'true'
  })

  it('returns null without token (401 path)', async () => {
    expect(await resolveRequestAuth(mockReq())).toBeNull()
  })

  it('rejects invalid token', async () => {
    expect(await resolveRequestAuth(mockReq('Bearer invalid'))).toBeNull()
  })

  it('accepts valid test technician token', async () => {
    const ctx = await resolveRequestAuth(mockReq('Bearer test-tech-org-a'))
    expect(ctx?.userId).toBeTruthy()
    expect(ctx?.permissions).toContain('field_sync.execute')
  })

  it('rejects suspended membership', async () => {
    await expect(resolveRequestAuth(mockReq('Bearer test-suspended'))).rejects.toThrow(/suspended/i)
  })

  it('extracts bearer token', () => {
    expect(extractBearerToken(mockReq('Bearer abc'))).toBe('abc')
  })
})

describe('tenant isolation — 8B.7F', () => {
  it('denies cross-tenant mission access', async () => {
    const techB = (await resolveRequestAuth(mockReq('Bearer test-tech-org-b')))!
    await expect(authorizeMissionAccess(techB, TEST_MISSION_ORG_A)).rejects.toBeInstanceOf(
      AuthorizationError,
    )
  })

  it('allows same-tenant mission access for assignee', async () => {
    const techA = (await resolveRequestAuth(mockReq('Bearer test-tech-org-a')))!
    const ctx = await authorizeMissionAccess(techA, TEST_MISSION_ORG_A, { requireAssignee: true })
    expect(ctx.organizationId).toBe(TEST_ORG_A)
  })

  it('field sync requires field_sync.execute and tenant match', async () => {
    const techA = (await resolveRequestAuth(mockReq('Bearer test-tech-org-a')))!
    await expect(
      authorizeFieldSyncAccess(techA, { mission_id: TEST_MISSION_ORG_A, bundle_id: 'b1' }),
    ).resolves.toBeTruthy()
    await expect(
      authorizeFieldSyncAccess(techA, { mission_id: TEST_MISSION_ORG_B, bundle_id: 'b2' }),
    ).rejects.toBeInstanceOf(AuthorizationError)
  })

  it('technician without assign permission cannot access other org mission', async () => {
    const techB = (await resolveRequestAuth(mockReq('Bearer test-tech-org-b')))!
    await expect(
      authorizeFieldSyncAccess(techB, { mission_id: TEST_MISSION_ORG_A, bundle_id: 'b3' }),
    ).rejects.toBeInstanceOf(AuthorizationError)
  })
})
