import { describe, expect, it, beforeEach } from 'vitest'
import { IncomingMessage } from 'node:http'
import { Socket } from 'node:net'

import { resolveRequestAuth } from './resolve-auth-context.js'
import {
  authorizeEvidenceSubmissionRead,
  authorizeEvidenceSubmissionWrite,
  authorizeFindingAccess,
  authorizeIncidentAccess,
  authorizeMissionAccess,
  authorizeOfflinePackageAccess,
  authorizeSignedUploadUrl,
  authorizeVerificationNeedAccess,
} from '../services/authorization/index.js'
import {
  TEST_FINDING_ORG_A,
  TEST_INCIDENT_ORG_A,
  TEST_NEED_ORG_A,
  TEST_PACKAGE_ORG_A,
  TEST_SUBMISSION_ORG_A,
  TEST_SUBMISSION_ORG_B,
  TEST_TASK_ORG_A,
} from './resource-fixtures.js'
import { TEST_MISSION_ORG_A, TEST_MISSION_ORG_B } from './test-fixtures.js'
import { AuthorizationError } from '@/core/auth/permissions.js'
import {
  assertMissionTaskBelongsToMission,
  assertPackageBelongsToMission,
} from './payload-tenant-guard.js'

process.env.AUTH_TEST_MODE = '1'
process.env.AUTH_ENFORCE = 'true'

function mockReq(authHeader?: string): IncomingMessage {
  const socket = new Socket()
  const req = new IncomingMessage(socket)
  if (authHeader) req.headers.authorization = authHeader
  return req
}

describe('operational authorization — 8B.7F.2', () => {
  beforeEach(() => {
    process.env.AUTH_TEST_MODE = '1'
    process.env.AUTH_ENFORCE = 'true'
  })

  it('denies cross-tenant incident read via authorizer', async () => {
    const techB = (await resolveRequestAuth(mockReq('Bearer test-tech-org-b')))!
    await expect(authorizeIncidentAccess(techB, TEST_INCIDENT_ORG_A)).rejects.toBeInstanceOf(
      AuthorizationError,
    )
  })

  it('denies sequential UUID enumeration on mission access', async () => {
    const techA = (await resolveRequestAuth(mockReq('Bearer test-tech-org-a')))!
    await expect(
      authorizeMissionAccess(techA, '00000000-0000-4000-a07f-000000009999'),
    ).rejects.toBeInstanceOf(AuthorizationError)
  })

  it('denies cross-tenant evidence submission read', async () => {
    const techA = (await resolveRequestAuth(mockReq('Bearer test-tech-org-a')))!
    await expect(authorizeEvidenceSubmissionRead(techA, TEST_SUBMISSION_ORG_B)).rejects.toBeInstanceOf(
      AuthorizationError,
    )
  })

  it('denies signed URL for foreign submission', async () => {
    const techA = (await resolveRequestAuth(mockReq('Bearer test-tech-org-a')))!
    await expect(authorizeSignedUploadUrl(techA, TEST_SUBMISSION_ORG_B)).rejects.toBeInstanceOf(
      AuthorizationError,
    )
  })

  it('denies offline package from other tenant', async () => {
    const techB = (await resolveRequestAuth(mockReq('Bearer test-tech-org-b')))!
    await expect(
      authorizeOfflinePackageAccess(techB, TEST_PACKAGE_ORG_A, 'download'),
    ).rejects.toBeInstanceOf(AuthorizationError)
  })

  it('denies task from other mission in payload guard', async () => {
    const techA = (await resolveRequestAuth(mockReq('Bearer test-tech-org-a')))!
    await expect(
      assertMissionTaskBelongsToMission(techA, TEST_MISSION_ORG_B, TEST_TASK_ORG_A),
    ).rejects.toBeInstanceOf(AuthorizationError)
  })

  it('denies package valid but mission mismatch', async () => {
    const techA = (await resolveRequestAuth(mockReq('Bearer test-tech-org-a')))!
    await expect(
      assertPackageBelongsToMission(techA, TEST_MISSION_ORG_B, TEST_PACKAGE_ORG_A),
    ).rejects.toBeInstanceOf(AuthorizationError)
  })

  it('allows same-tenant submission write for assignee', async () => {
    const techA = (await resolveRequestAuth(mockReq('Bearer test-tech-org-a')))!
    await expect(
      authorizeEvidenceSubmissionWrite(techA, TEST_SUBMISSION_ORG_A),
    ).resolves.toBeTruthy()
  })

  it('denies finding from other tenant', async () => {
    const techB = (await resolveRequestAuth(mockReq('Bearer test-tech-org-b')))!
    await expect(authorizeFindingAccess(techB, TEST_FINDING_ORG_A)).rejects.toBeInstanceOf(
      AuthorizationError,
    )
  })

  it('denies verification need from other tenant', async () => {
    const techB = (await resolveRequestAuth(mockReq('Bearer test-tech-org-b')))!
    await expect(authorizeVerificationNeedAccess(techB, TEST_NEED_ORG_A)).rejects.toBeInstanceOf(
      AuthorizationError,
    )
  })

  it('rejects suspended membership before resource access', async () => {
    await expect(resolveRequestAuth(mockReq('Bearer test-suspended'))).rejects.toThrow(/suspended/i)
  })
})
