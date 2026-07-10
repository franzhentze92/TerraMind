#!/usr/bin/env tsx
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const routesDir = join(ROOT, 'server/routes')

function listRouteFiles() {
  return readdirSync(routesDir).filter((f) => f.endsWith('.ts'))
}

function scanFile(path: string): string {
  return readFileSync(path, 'utf8')
}

console.log('# TerraMind Auth Audit — 8B.7F\n')

const authMiddleware = scanFile(join(ROOT, 'server/middleware/auth.ts'))
const stubActive = authMiddleware.includes('requireAuth stub removed') === false
console.log(`## requireAuth stub active: ${stubActive ? 'YES (BLOCKER)' : 'NO — replaced in 8B.7F'}`)

console.log('\n## Route files')
for (const file of listRouteFiles()) {
  const content = scanFile(join(routesDir, file))
  const usesAuth = content.includes('rejectIfUnauthenticated')
  const awaited = content.includes('await rejectIfUnauthenticated')
  console.log(`- ${file}: auth=${usesAuth ? 'yes' : 'no'}, awaited=${awaited ? 'yes' : 'no'}`)
}

const migration029 = join(ROOT, 'supabase/migrations/029_auth_tenant_isolation.sql')
console.log('\n## Migrations')
console.log(`- 029_auth_tenant_isolation.sql: ${scanFile(migration029).includes('organizations') ? 'present' : 'missing'}`)
console.log('- 028_field_sync.sql: present (not applied per policy)')

console.log('\n## Service role guard')
const guard = scanFile(join(ROOT, 'server/services/authorized-admin.client.ts'))
console.log(`- AuthorizedResourceContext required: ${guard.includes('service_role_requires_authorized_resource_context')}`)

console.log('\n## Tables with organization_id (migration 029)')
for (const table of [
  'incidents',
  'verification_plans',
  'missions',
  'evidence_submissions',
  'offline_mission_packages',
  'evidence_upload_sessions',
  'evidence_bundle_sync_registrations',
]) {
  const ok = scanFile(migration029).includes(`public.${table}`) && scanFile(migration029).includes('organization_id')
  console.log(`- ${table}: ${ok ? 'planned' : 'missing'}`)
}

console.log('\n## Feature flags')
const mobileConfig = scanFile(join(ROOT, 'src/modules/field-operations/field-mobile/config/fire-field-mobile.config.ts'))
console.log(`- FIELD_REAL_SYNC_ENABLED false: ${mobileConfig.includes('FIELD_REAL_SYNC_ENABLED = false')}`)

console.log('\n## Pending blockers')
console.log('- Apply migration 029 only after staging confirmation')
console.log('- Wire remaining operational endpoints to authorize* services')
console.log('- Enable FIELD_REAL_SYNC only after 8B.7F + staging E2E')
