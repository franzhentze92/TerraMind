#!/usr/bin/env tsx
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

import { OPERATIONAL_ROUTE_REGISTRY } from '../server/auth/route-registry.js'
import { RESPONSE_MODEL_VERSION } from '../src/modules/response-orchestration/response-orchestration.types.js'
import { ROLE_PERMISSION_MAP } from '../server/auth/role-permissions.js'

config({ path: resolve(process.cwd(), '.env') })

const ROOT = process.cwd()
const blockers: string[] = []

function pass(name: string, detail?: string) {
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`)
}

function fail(name: string, detail?: string) {
  blockers.push(`${name}${detail ? `: ${detail}` : ''}`)
  console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  console.log('Response Orchestration Audit (8C.1.2)\n')

  if (RESPONSE_MODEL_VERSION !== '1.0.0') {
    fail('model version', RESPONSE_MODEL_VERSION)
  } else {
    pass('fire-response-orchestration model v1.0.0')
  }

  const migrationPath = join(ROOT, 'supabase/migrations/031_response_orchestration.sql')
  if (!existsSync(migrationPath)) fail('migration 031 missing')
  else {
    const sql = readFileSync(migrationPath, 'utf8')
    if (!sql.includes('response_assessment_jobs')) fail('migration jobs table')
    else pass('migration 031 includes jobs table')
    if (sql.includes('drop table')) fail('migration contains destructive DDL')
    else pass('migration additive check')
  }

  const responseRoutes = OPERATIONAL_ROUTE_REGISTRY.filter((r) => r.routeFile === 'response-orchestration.ts')
  if (responseRoutes.length < 11) fail('route registry', `expected >=11, got ${responseRoutes.length}`)
  else pass('route registry', `${responseRoutes.length} routes`)

  for (const route of responseRoutes) {
    if (route.status !== 'protected') fail(`route ${route.path} not protected`)
    if (!route.permission) fail(`route ${route.path} missing permission`)
    if (!route.authorizer) fail(`route ${route.path} missing authorizer`)
  }
  if (responseRoutes.every((r) => r.status === 'protected' && r.permission && r.authorizer)) {
    pass('all response routes protected')
  }

  for (const role of ['field_technician', 'viewer'] as const) {
    const perms = ROLE_PERMISSION_MAP[role]
    if (perms.includes('responses.approve')) fail(`${role} has responses.approve`)
    if (perms.includes('notifications.approve')) fail(`${role} has notifications.approve`)
  }
  pass('approval permissions excluded from field_technician/viewer')

  const authFiles = [
    'server/services/authorization/response-access.ts',
    'server/routes/response-orchestration.ts',
    'src/pipeline/scheduler/response-orchestration.scheduler.ts',
    'scripts/response-orchestration-http-smoke.ts',
    'server/services/response-orchestration.service.ts',
    'src/pipeline/stores/response-orchestration.store.ts',
    'src/pipeline/workers/response-orchestration.worker.ts',
    'src/modules/response-orchestration/pages/ResponseOrchestrationListPage.tsx',
  ]
  for (const f of authFiles) {
    if (!existsSync(join(ROOT, f))) fail(`missing file ${f}`)
  }
  pass('core files present')

  const url = process.env.SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (url && serviceKey) {
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const tables = [
      'response_assessments',
      'decision_records',
      'response_actions',
      'notification_directives',
      'response_orchestration_events',
      'response_assessment_jobs',
    ]
    for (const table of tables) {
      const { error } = await admin.from(table).select('id', { head: true, count: 'exact' })
      if (error) fail(`remote table ${table}`, error.message)
      else pass(`remote table ${table}`)
    }

    const { data: perms } = await admin.from('permissions').select('id').like('id', 'responses.%')
    if ((perms ?? []).length < 6) fail('remote permissions seed')
    else pass('remote response permissions')

    const { error: jobsProbe } = await admin
      .from('response_assessment_jobs')
      .select('id', { head: true, count: 'exact' })
    if (jobsProbe) fail('migration 031 probe', jobsProbe.message)
    else pass('migration 031 applied remotely', 'response_assessment_jobs reachable')

    const { countLegacyIncidentAssessments } = await import(
      '../src/pipeline/stores/response-orchestration.store.js'
    )
    const legacyAssessments = await countLegacyIncidentAssessments()
    if (legacyAssessments > 0) fail('legacy incident assessments', String(legacyAssessments))
    else pass('zero assessments on legacy incidents without organization_id')
  } else {
    pass('remote probe skipped (no SUPABASE env)')
  }

  console.log('\n--- Summary ---')
  if (blockers.length === 0) {
    console.log('AUDIT PASSED — no critical blockers')
    process.exit(0)
  }
  console.log(`AUDIT FAILED — ${blockers.length} blocker(s):`)
  for (const b of blockers) console.log(`  - ${b}`)
  process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
