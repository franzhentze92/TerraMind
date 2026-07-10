#!/usr/bin/env tsx
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

import {
  incompleteRegistryRoutes,
  protectedRegistryRoutes,
  OPERATIONAL_ROUTE_REGISTRY,
} from '../server/auth/route-registry.js'

config({ path: resolve(process.cwd(), '.env') })

const ROOT = process.cwd()
const routesDir = join(ROOT, 'server/routes')
const migrationsDir = join(ROOT, 'supabase/migrations')
const blockers: string[] = []

const EXPECTED_AUTH_MIGRATIONS = [
  '028_field_sync.sql',
  '029_auth_tenant_isolation.sql',
  '030_auth_provisioning.sql',
] as const

type RemoteMigrationStatus = 'verified' | 'missing' | 'unknown'

function scan(path: string): string {
  return readFileSync(path, 'utf8')
}

function listRouteFiles(): string[] {
  return readdirSync(routesDir).filter((f) => f.endsWith('.ts'))
}

function migrationBaseName(fileName: string): string {
  return fileName.replace(/\.sql$/, '')
}

const MIGRATION_TABLE_PROBES: Record<string, string> = {
  '028_field_sync': 'evidence_upload_sessions',
  '029_auth_tenant_isolation': 'organizations',
  '030_auth_provisioning': 'organization_invitations',
}

async function probeMigrationViaTables(
  admin: ReturnType<typeof createClient>,
): Promise<Map<string, RemoteMigrationStatus>> {
  const result = new Map<string, RemoteMigrationStatus>()
  for (const file of EXPECTED_AUTH_MIGRATIONS) {
    const name = migrationBaseName(file)
    const table = MIGRATION_TABLE_PROBES[name]
    if (!table) {
      result.set(name, 'unknown')
      continue
    }
    const { error } = await admin.from(table).select('id', { head: true, count: 'exact' })
    result.set(name, error ? 'missing' : 'verified')
  }
  return result
}

async function probeRemoteMigrationStatus(): Promise<{
  statuses: Map<string, RemoteMigrationStatus>
  method: 'schema_migrations' | 'schema_probe' | 'none'
}> {
  const result = new Map<string, RemoteMigrationStatus>()
  for (const file of EXPECTED_AUTH_MIGRATIONS) {
    result.set(migrationBaseName(file), 'unknown')
  }

  const url = process.env.SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !serviceKey) return { statuses: result, method: 'none' }

  try {
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data, error } = await admin
      .schema('supabase_migrations')
      .from('schema_migrations')
      .select('name')
      .in(
        'name',
        EXPECTED_AUTH_MIGRATIONS.map((f) => migrationBaseName(f)),
      )

    if (!error && data && data.length > 0) {
      const applied = new Set(data.map((row) => String(row.name)))
      for (const file of EXPECTED_AUTH_MIGRATIONS) {
        const name = migrationBaseName(file)
        result.set(name, applied.has(name) ? 'verified' : 'missing')
      }
      return { statuses: result, method: 'schema_migrations' }
    }

    const probed = await probeMigrationViaTables(admin)
    return { statuses: probed, method: 'schema_probe' }
  } catch {
    return { statuses: result, method: 'none' }
  }
}

console.log('# TerraMind Auth Audit — 8B.7F\n')

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
console.log(
  `- AuthorizedResourceContext required: ${guard.includes('service_role_requires_authorized_resource_context')}`,
)

console.log('\n## Migrations')
const { statuses: remoteStatus, method: remoteMethod } = await probeRemoteMigrationStatus()
const remoteChecked = remoteMethod !== 'none'

for (const file of EXPECTED_AUTH_MIGRATIONS) {
  const localPath = join(migrationsDir, file)
  const localExists = existsSync(localPath)
  const remote = remoteStatus.get(migrationBaseName(file)) ?? 'unknown'
  console.log(`- ${file}:`)
  console.log(`  - migration file exists locally: ${localExists ? 'yes' : 'no'}`)
  console.log(`  - migration expected: yes`)
  if (!remoteChecked) {
    console.log(`  - remote migration status: not checked by this audit`)
  } else if (remote === 'verified') {
    console.log(
      `  - remote migration status: verified${remoteMethod === 'schema_probe' ? ' (schema probe)' : ''}`,
    )
  } else if (remote === 'missing') {
    console.log(`  - remote migration status: missing`)
    blockers.push(`Remote migration missing: ${migrationBaseName(file)}`)
  } else {
    console.log(`  - remote migration status: unknown`)
  }
}

if (!remoteChecked) {
  console.log('- Remote migration status not checked by this audit')
  console.log('  (set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to probe remote schema)')
} else if (remoteMethod === 'schema_probe') {
  console.log('- Remote probe method: characteristic table existence (schema_migrations unavailable via API)')
}

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
console.log('- 8B.7F operational authorization gate')
if (remoteChecked) {
  const allVerified = [...remoteStatus.values()].every((s) => s === 'verified')
  console.log(`- Auth migrations remote: ${allVerified ? '028/029/030 verified' : 'see blockers'}`)
} else {
  console.log('- Auth migrations remote: not checked')
}
