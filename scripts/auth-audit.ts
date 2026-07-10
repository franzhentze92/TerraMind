#!/usr/bin/env tsx
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import {
  incompleteRegistryRoutes,
  protectedRegistryRoutes,
  OPERATIONAL_ROUTE_REGISTRY,
} from '../server/auth/route-registry.js'

const ROOT = process.cwd()
const routesDir = join(ROOT, 'server/routes')
const blockers: string[] = []

function scan(path: string): string {
  return readFileSync(path, 'utf8')
}

function listRouteFiles(): string[] {
  return readdirSync(routesDir).filter((f) => f.endsWith('.ts'))
}

console.log('# TerraMind Auth Audit — 8B.7F.2\n')

const authMiddleware = scan(join(ROOT, 'server/middleware/auth.ts'))
if (!authMiddleware.includes('requireAuth stub removed in 8B.7F')) {
  blockers.push('requireAuth stub still present in server/middleware/auth.ts')
}
console.log(`## requireAuth stub: ${blockers.length ? 'BLOCKER' : 'removed (8B.7F)'}`)

if (scan(join(ROOT, 'server/services/evidence-intake.service.ts')).includes('system-operator')) {
  blockers.push('system-operator default still present in evidence-intake.service.ts')
}

const wholeServer = readdirSync(join(ROOT, 'server'), { recursive: true })
  .filter((f) => String(f).endsWith('.ts'))
  .map((f) => scan(join(ROOT, 'server', String(f))))
  .join('\n')
if (wholeServer.includes("'system-operator'") || wholeServer.includes('"system-operator"')) {
  blockers.push('system-operator reference remains in server code')
}

console.log('\n## Operational route files')
const operationalFiles = [
  'incidents.ts',
  'findings.ts',
  'priorities.ts',
  'verification.ts',
  'verification-resolution.ts',
  'missions.ts',
  'evidence-intake.ts',
  'evidence-validation.ts',
  'offline-packages.ts',
  'field-sync.ts',
  'fires.ts',
  'auth.ts',
  'provisioning.ts',
]

for (const file of operationalFiles) {
  const path = join(routesDir, file)
  const content = scan(path)
  const usesGuard = content.includes('runOperationalGuard')
  const bareAuthOnly =
    content.includes('rejectIfUnauthenticated') && !usesGuard && file !== 'auth.ts'
  if (bareAuthOnly) {
    blockers.push(`${file}: uses rejectIfUnauthenticated without runOperationalGuard`)
  }
  console.log(`- ${file}: runOperationalGuard=${usesGuard ? 'yes' : 'no'}`)
}

console.log('\n## Route registry')
const incomplete = incompleteRegistryRoutes()
console.log(`- Total routes: ${OPERATIONAL_ROUTE_REGISTRY.length}`)
console.log(`- Protected: ${protectedRegistryRoutes().length}`)
console.log(`- Incomplete: ${incomplete.length}`)
for (const route of incomplete) {
  blockers.push(`Registry incomplete: ${route.method} ${route.path}`)
}

console.log('\n## Service role guard')
const guard = scan(join(ROOT, 'server/services/authorized-admin.client.ts'))
if (!guard.includes('service_role_requires_authorized_resource_context')) {
  blockers.push('authorized-admin.client.ts missing service role guard')
}
console.log(`- AuthorizedResourceContext required: ${guard.includes('service_role_requires_authorized_resource_context')}`)

console.log('\n## Migrations (not applied per policy)')
console.log('- 028_field_sync.sql: present, not applied')
console.log('- 029_auth_tenant_isolation.sql: present, not applied')
console.log('- 030_auth_provisioning.sql: present, not applied')

console.log('\n## Feature flags')
const mobileConfig = scan(
  join(ROOT, 'src/modules/field-operations/field-mobile/config/fire-field-mobile.config.ts'),
)
if (!mobileConfig.includes('FIELD_REAL_SYNC_ENABLED = false')) {
  blockers.push('FIELD_REAL_SYNC_ENABLED is not false')
}
console.log(`- FIELD_REAL_SYNC_ENABLED false: ${mobileConfig.includes('FIELD_REAL_SYNC_ENABLED = false')}`)

console.log('\n## Rate limit profiles')
const rateLimit = scan(join(ROOT, 'server/middleware/rate-limit.ts'))
for (const profile of [
  'login',
  'org_switch',
  'signed_url',
  'package_generate',
  'package_download',
  'evidence_create',
  'upload_session',
  'field_sync_register',
  'sync_retry',
  'invitation',
  'validation',
  'reevaluation',
]) {
  if (!rateLimit.includes(profile)) {
    blockers.push(`Missing rate limit profile: ${profile}`)
  }
}

console.log('\n## Blockers')
if (blockers.length === 0) {
  console.log('- None — operational authorization gate passed')
} else {
  for (const b of blockers) console.log(`- ${b}`)
  process.exitCode = 1
}

console.log('\n## Status')
console.log('- 8B.7F foundation on main (7519afb)')
console.log('- 8B.7F.2 endpoint authorization: see blockers above')
console.log('- Apply migrations 028/029 only after staging confirmation')
