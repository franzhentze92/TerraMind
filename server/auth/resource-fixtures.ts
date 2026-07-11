import {
  TEST_MISSION_ORG_A,
  TEST_MISSION_ORG_B,
  TEST_ORG_A,
  TEST_ORG_B,
} from './test-fixtures.js'

export interface TenantResourceSnapshot {
  id: string
  organization_id: string | null
  mission_id?: string | null
  incident_id?: string | null
  verification_plan_id?: string | null
}

export const TEST_INCIDENT_ORG_A = '00000000-0000-4000-a07f-00000000e001'
export const TEST_INCIDENT_ORG_B = '00000000-0000-4000-a07f-00000000e002'
export const TEST_LEGACY_INCIDENT = '00000000-0000-4000-a07f-00000000e099'
export const TEST_PLAN_ORG_A = '00000000-0000-4000-a07f-00000000p001'
export const TEST_SUBMISSION_ORG_A = '00000000-0000-4000-a07f-00000000s001'
export const TEST_SUBMISSION_ORG_B = '00000000-0000-4000-a07f-00000000s002'
export const TEST_PACKAGE_ORG_A = '00000000-0000-4000-a07f-00000000k001'
export const TEST_TASK_ORG_A = '00000000-0000-4000-a07f-00000000t001'
export const TEST_FINDING_ORG_A = '00000000-0000-4000-a07f-00000000d001'
export const TEST_PRIORITY_ORG_A = '00000000-0000-4000-a07f-00000000r001'
export const TEST_NEED_ORG_A = '00000000-0000-4000-a07f-00000000n001'

const INCIDENTS: Record<string, TenantResourceSnapshot> = {
  [TEST_INCIDENT_ORG_A]: { id: TEST_INCIDENT_ORG_A, organization_id: TEST_ORG_A },
  [TEST_INCIDENT_ORG_B]: { id: TEST_INCIDENT_ORG_B, organization_id: TEST_ORG_B },
  [TEST_LEGACY_INCIDENT]: { id: TEST_LEGACY_INCIDENT, organization_id: null },
}

const PLANS: Record<string, TenantResourceSnapshot> = {
  [TEST_PLAN_ORG_A]: {
    id: TEST_PLAN_ORG_A,
    organization_id: TEST_ORG_A,
    incident_id: TEST_INCIDENT_ORG_A,
  },
}

const SUBMISSIONS: Record<string, TenantResourceSnapshot> = {
  [TEST_SUBMISSION_ORG_A]: {
    id: TEST_SUBMISSION_ORG_A,
    organization_id: TEST_ORG_A,
    mission_id: TEST_MISSION_ORG_A,
  },
  [TEST_SUBMISSION_ORG_B]: {
    id: TEST_SUBMISSION_ORG_B,
    organization_id: TEST_ORG_B,
    mission_id: TEST_MISSION_ORG_B,
  },
}

const PACKAGES: Record<string, TenantResourceSnapshot> = {
  [TEST_PACKAGE_ORG_A]: {
    id: TEST_PACKAGE_ORG_A,
    organization_id: TEST_ORG_A,
    mission_id: TEST_MISSION_ORG_A,
  },
}

const TASKS: Record<string, TenantResourceSnapshot> = {
  [TEST_TASK_ORG_A]: {
    id: TEST_TASK_ORG_A,
    organization_id: TEST_ORG_A,
    mission_id: TEST_MISSION_ORG_A,
  },
}

const FINDINGS: Record<string, TenantResourceSnapshot> = {
  [TEST_FINDING_ORG_A]: { id: TEST_FINDING_ORG_A, organization_id: TEST_ORG_A },
}

const PRIORITIES: Record<string, TenantResourceSnapshot> = {
  [TEST_PRIORITY_ORG_A]: { id: TEST_PRIORITY_ORG_A, organization_id: TEST_ORG_A },
}

const NEEDS: Record<string, TenantResourceSnapshot> = {
  [TEST_NEED_ORG_A]: {
    id: TEST_NEED_ORG_A,
    organization_id: TEST_ORG_A,
    verification_plan_id: TEST_PLAN_ORG_A,
  },
}

export function isAuthTestMode(): boolean {
  return process.env.AUTH_TEST_MODE === '1' || process.env.NODE_ENV === 'test'
}

export function testIncidentSnapshot(id: string) {
  return INCIDENTS[id] ?? null
}

export function testPlanSnapshot(id: string) {
  return PLANS[id] ?? null
}

export function testSubmissionSnapshot(id: string) {
  return SUBMISSIONS[id] ?? null
}

export function testPackageSnapshot(id: string) {
  return PACKAGES[id] ?? null
}

export function testTaskSnapshot(id: string) {
  return TASKS[id] ?? null
}

export function testFindingSnapshot(id: string) {
  return FINDINGS[id] ?? null
}

export function testPrioritySnapshot(id: string) {
  return PRIORITIES[id] ?? null
}

export function testNeedSnapshot(id: string) {
  return NEEDS[id] ?? null
}
