#!/usr/bin/env tsx
/**
 * 8B.7F.4 — Database activation & real auth smoke test.
 * Safe by default: requires explicit mode + --confirm-project for remote operations.
 * Secrets only from environment variables — never logged.
 *
 * Example:
 *   npm run auth:activation-8b7f4 -- --mode=smoke --confirm-project=YOUR_PROJECT_REF
 */
import { randomUUID } from 'node:crypto'
import { config } from 'dotenv'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { createClient } from '@supabase/supabase-js'

import { getSupabaseAdmin, resetSupabaseClient } from '../src/pipeline/stores/supabase.client.js'
import { getBootstrapStatus, runPlatformBootstrap } from '../server/services/provisioning/bootstrap.service.js'

config({ path: resolve(process.cwd(), '.env') })

type ActivationMode = 'preflight' | 'apply' | 'bootstrap' | 'smoke' | 'report' | 'full'

interface CliOptions {
  mode: ActivationMode
  confirmProject: string | null
  allowUserProvisioning: boolean
  allowPasswordReset: boolean
}

interface CheckResult {
  name: string
  ok: boolean
  detail?: string
  mutates?: boolean
}

const checks: CheckResult[] = []

const EXPECTED_MIGRATIONS = ['028_field_sync', '029_auth_tenant_isolation', '030_auth_provisioning']

function pass(name: string, detail?: string, mutates = false) {
  checks.push({ name, ok: true, detail, mutates })
}

function fail(name: string, detail?: string, mutates = false) {
  checks.push({ name, ok: false, detail, mutates })
}

function parseArgs(argv: string[]): CliOptions {
  let mode: ActivationMode | null = null
  let confirmProject: string | null = null
  let allowUserProvisioning = false
  let allowPasswordReset = false

  for (const arg of argv) {
    if (arg.startsWith('--mode=')) mode = arg.slice('--mode='.length) as ActivationMode
    if (arg.startsWith('--confirm-project=')) confirmProject = arg.slice('--confirm-project='.length).trim()
    if (arg === '--allow-user-provisioning') allowUserProvisioning = true
    if (arg === '--allow-password-reset') allowPasswordReset = true
  }

  if (!mode) {
    console.error(`Usage:
  npm run auth:activation-8b7f4 -- --mode=preflight
  npm run auth:activation-8b7f4 -- --mode=smoke --confirm-project=YOUR_PROJECT_REF
  npm run auth:activation-8b7f4 -- --mode=bootstrap --confirm-project=YOUR_PROJECT_REF
  npm run auth:activation-8b7f4 -- --mode=report --confirm-project=YOUR_PROJECT_REF
  npm run auth:activation-8b7f4 -- --mode=full --confirm-project=YOUR_PROJECT_REF --allow-user-provisioning

Modes:
  preflight  Local checks only (no remote mutation)
  apply      Verify migrations already applied remotely (no DDL from this script)
  bootstrap  One-shot platform bootstrap (mutates remote)
  smoke      Real auth/API smoke tests (mutates test invitations only)
  report     Write remote status artifact (read-only)
  full       apply + bootstrap + smoke + report (requires explicit provisioning flags)

Required env for remote modes:
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  smoke/full: SUPABASE_ANON_KEY, AUTH_TEST_EMAIL, AUTH_TEST_PASSWORD
  bootstrap/full: AUTH_BOOTSTRAP_TOKEN, AUTH_BOOTSTRAP_AUTH_USER_ID
`)
    process.exit(1)
  }

  return { mode, confirmProject, allowUserProvisioning, allowPasswordReset }
}

function extractProjectRef(supabaseUrl: string): string | null {
  const match = supabaseUrl.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i)
  return match?.[1] ?? null
}

function maskProjectRef(ref: string): string {
  if (ref.length <= 8) return '****'
  return `${ref.slice(0, 4)}…${ref.slice(-4)}`
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} required`)
  return value
}

function assertRemoteConfirmation(options: CliOptions): string {
  const url = requireEnv('SUPABASE_URL')
  const ref = extractProjectRef(url)
  if (!ref) throw new Error('SUPABASE_URL invalid — expected https://<project-ref>.supabase.co')
  if (!options.confirmProject) {
    throw new Error('--confirm-project required for remote modes')
  }
  if (options.confirmProject !== ref) {
    throw new Error(
      `--confirm-project mismatch (expected ${maskProjectRef(ref)}, got ${maskProjectRef(options.confirmProject)})`,
    )
  }
  console.log(`Remote target confirmed: project ${maskProjectRef(ref)}`)
  return ref
}

function baseUrl(): string {
  return `http://127.0.0.1:${process.env.TERRAMIND_PORT ?? '3001'}`
}

async function api(
  path: string,
  init: RequestInit & { token?: string | null; orgId?: string | null } = {},
): Promise<{ status: number; body: unknown }> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.token) headers.set('Authorization', `Bearer ${init.token}`)
  if (init.orgId) headers.set('x-terramind-organization-id', init.orgId)
  const res = await fetch(`${baseUrl()}${path}`, { ...init, headers })
  let body: unknown = null
  const text = await res.text()
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }
  return { status: res.status, body }
}

async function runPreflight(): Promise<void> {
  for (const file of EXPECTED_MIGRATIONS.map((m) => `${m}.sql`)) {
    const exists = existsSync(resolve(process.cwd(), 'supabase/migrations', file))
    if (exists) pass(`local_migration_${file}`, 'exists')
    else fail(`local_migration_${file}`, 'missing')
  }

  const destructive = ['DROP ', 'TRUNCATE ', 'DELETE FROM']
  for (const migration of EXPECTED_MIGRATIONS) {
    const content = readFileSync(resolve(process.cwd(), `supabase/migrations/${migration}.sql`), 'utf8')
    const hit = destructive.find((token) => content.includes(token))
    if (hit) fail(`migration_${migration}_additive`, `found ${hit.trim()}`)
    else pass(`migration_${migration}_additive`, 'no destructive statements')
  }
}

const MIGRATION_TABLE_PROBES: Record<string, string> = {
  '028_field_sync': 'evidence_upload_sessions',
  '029_auth_tenant_isolation': 'organizations',
  '030_auth_provisioning': 'organization_invitations',
}

async function verifyRemoteMigrations(): Promise<{ verified: string[]; missing: string[] }> {
  resetSupabaseClient()
  const admin = getSupabaseAdmin()
  const verified: string[] = []
  const missing: string[] = []

  for (const migration of EXPECTED_MIGRATIONS) {
    const table = MIGRATION_TABLE_PROBES[migration]
    if (!table) {
      missing.push(migration)
      continue
    }
    const { error } = await admin.from(table).select('id', { head: true, count: 'exact' })
    if (error) missing.push(migration)
    else verified.push(migration)
  }

  return { verified, missing }
}

async function runApplyVerify(): Promise<void> {
  const { verified, missing } = await verifyRemoteMigrations()
  for (const migration of verified) pass(`remote_migration_${migration}`, 'verified (schema probe)')
  for (const migration of missing) fail(`remote_migration_${migration}`, 'missing')
  pass('apply_mode_no_ddl', 'script does not execute DDL (use Supabase migrations tooling)')
}

async function resolveExistingAuthUser(options: CliOptions): Promise<{ authUserId: string; email: string }> {
  const email = requireEnv('AUTH_TEST_EMAIL')
  const admin = getSupabaseAdmin()
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 })
  if (error) throw new Error(`list_users_failed:${error.message}`)

  const existing = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (existing?.id) {
    pass('auth_user_exists', `domain=${email.split('@')[1] ?? 'unknown'}`)
    if (options.allowPasswordReset) {
      fail('password_reset_blocked', 'use Supabase dashboard reset — script never persists passwords', true)
    }
    return { authUserId: existing.id, email }
  }

  if (!options.allowUserProvisioning) {
    throw new Error(
      'Auth user not found. Create the user in Supabase Auth first, or rerun with --allow-user-provisioning (full mode only).',
    )
  }

  throw new Error(
    'Automatic user creation disabled. Create AUTH_TEST_EMAIL in Supabase Auth, then rerun bootstrap/smoke.',
  )
}

async function runBootstrap(authUserId: string, email: string): Promise<void> {
  const token = requireEnv('AUTH_BOOTSTRAP_TOKEN')
  const allowedAuthUserId = requireEnv('AUTH_BOOTSTRAP_AUTH_USER_ID')
  if (authUserId !== allowedAuthUserId) {
    throw new Error('AUTH_BOOTSTRAP_AUTH_USER_ID does not match AUTH_TEST_EMAIL user')
  }

  pass('bootstrap_start', 'mutates remote provisioning tables', true)
  const result = await runPlatformBootstrap({
    auth_user_id: authUserId,
    email,
    display_name: process.env.AUTH_TEST_DISPLAY_NAME?.trim() || 'Platform Admin',
    bootstrap_token: token,
  })

  if (result.already_completed) pass('bootstrap_already_completed', undefined, true)
  else if (result.ok) pass('bootstrap_completed', `org=${result.organization_id?.slice(0, 8)}…`, true)
  else fail('bootstrap_completed', 'unexpected result', true)

  const status = getBootstrapStatus()
  if (status.enabled) fail('bootstrap_disabled_after_run', 'remove bootstrap env vars')
  else pass('bootstrap_disabled_after_run')
}

async function signIn(email: string, password: string): Promise<string> {
  const client = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.session?.access_token) {
    throw new Error(`sign_in_failed:${error?.message ?? 'no_session'}`)
  }
  return data.session.access_token
}

async function runSmokeTests(): Promise<void> {
  const email = requireEnv('AUTH_TEST_EMAIL')
  const password = requireEnv('AUTH_TEST_PASSWORD')

  let token: string
  try {
    token = await signIn(email, password)
    pass('login_real')
  } catch (err) {
    fail('login_real', err instanceof Error ? err.message : String(err))
    return
  }

  const me = await api('/api/auth/me', { token })
  if (me.status === 200) {
    const payload = me.body as { state?: string; profile?: { is_platform_admin?: boolean } }
    if (payload.state === 'active' && payload.profile?.is_platform_admin) pass('auth_me_active_platform_admin')
    else fail('auth_me_active_platform_admin', `state=${payload.state ?? 'unknown'}`)
  } else fail('auth_me_active_platform_admin', `status=${me.status}`)

  if ((await api('/api/auth/me')).status === 401) pass('auth_me_unauthenticated_401')
  else fail('auth_me_unauthenticated_401')

  if ((await api('/api/auth/me', { token: 'invalid.jwt.token' })).status === 401) {
    pass('auth_me_invalid_token_401')
  } else fail('auth_me_invalid_token_401')

  if ((await api('/api/admin/organization/members', { token })).status === 200) pass('admin_list_members')
  else fail('admin_list_members')

  if ((await api('/api/admin/organization/roles', { token })).status === 200) pass('admin_list_roles')
  else fail('admin_list_roles')

  const inviteEmail = `8b7f4-smoke-${randomUUID().slice(0, 8)}@example.invalid`
  const inviteRes = await api('/api/admin/organization/invitations', {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: inviteEmail, display_name: 'Smoke Test Invite', roles: ['viewer'] }),
  })

  let invitationId: string | null = null
  if (inviteRes.status === 200 || inviteRes.status === 201) {
    const body = inviteRes.body as { invitation?: { id: string }; id?: string }
    invitationId = body.invitation?.id ?? body.id ?? null
    pass('admin_create_invitation', undefined, true)
  } else fail('admin_create_invitation', `status=${inviteRes.status}`, true)

  try {
    if (invitationId) {
      const admin = getSupabaseAdmin()
      const { data: row } = await admin
        .from('organization_invitations')
        .select('token_hash')
        .eq('id', invitationId)
        .maybeSingle()
      if (row?.token_hash && !String(row.token_hash).includes('@')) pass('invitation_token_hashed')
      else fail('invitation_token_hashed')

      const revoke = await api(`/api/admin/organization/invitations/${invitationId}/revoke`, {
        method: 'POST',
        token,
      })
      if (revoke.status === 200) pass('admin_revoke_invitation', undefined, true)
      else fail('admin_revoke_invitation', `status=${revoke.status}`, true)
    }

    const crossTenant = await api('/api/admin/organization/members', {
      token,
      orgId: '00000000-0000-4000-a07f-000000000099',
    })
    if ([401, 403].includes(crossTenant.status)) pass('cross_tenant_rejected', `status=${crossTenant.status}`)
    else fail('cross_tenant_rejected', `status=${crossTenant.status}`)

    if ((await api('/api/operations/field-sync/bundles/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status === 401) {
      pass('field_sync_unauthenticated_401')
    } else fail('field_sync_unauthenticated_401')

    const fieldSyncBad = await api('/api/operations/field-sync/bundles/register', {
      method: 'POST',
      token,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bundle_id: 'smoke-invalid',
        bundle_checksum: 'deadbeef',
        mission_id: randomUUID(),
        idempotency_key: `smoke-${randomUUID()}`,
      }),
    })
    if ([400, 403, 404].includes(fieldSyncBad.status)) pass('field_sync_invalid_rejected', `status=${fieldSyncBad.status}`)
    else fail('field_sync_invalid_rejected', `status=${fieldSyncBad.status}`)

    if ((await api('/api/operations/missions/00000000-0000-4000-a07f-000000000001/evidence')).status === 401) {
      pass('evidence_intake_unauthenticated_401')
    } else fail('evidence_intake_unauthenticated_401')

    const adminDb = getSupabaseAdmin()
    const { data: orgRow } = await adminDb.from('organizations').select('id').limit(1).maybeSingle()
    const tempProfileId = randomUUID()
    const tempMembershipId = randomUUID()
    let tempMemberCreated = false

    if (orgRow?.id) {
      try {
        await adminDb.from('user_profiles').insert({
          id: tempProfileId,
          auth_user_id: randomUUID(),
          email: `8b7f4-temp-${randomUUID().slice(0, 8)}@example.invalid`,
          display_name: 'Smoke Temp Member',
          active_organization_id: orgRow.id,
          is_platform_admin: false,
          provisioning_status: 'active',
        })
        await adminDb.from('organization_memberships').insert({
          id: tempMembershipId,
          organization_id: orgRow.id,
          user_id: tempProfileId,
          status: 'active',
          joined_at: new Date().toISOString(),
        })
        await adminDb.from('membership_roles').insert({ membership_id: tempMembershipId, role_id: 'viewer' })
        tempMemberCreated = true

        const suspend = await api(`/api/admin/organization/memberships/${tempMembershipId}/suspend`, {
          method: 'POST',
          token,
        })
        const { data: suspendedRow } = await adminDb
          .from('organization_memberships')
          .select('status')
          .eq('id', tempMembershipId)
          .single()
        const reactivate = await api(`/api/admin/organization/memberships/${tempMembershipId}/reactivate`, {
          method: 'POST',
          token,
        })
        const { data: restoredRow } = await adminDb
          .from('organization_memberships')
          .select('status')
          .eq('id', tempMembershipId)
          .single()

        if (suspend.status === 200 && suspendedRow?.status === 'suspended') pass('membership_suspend_temp_member', undefined, true)
        else fail('membership_suspend_temp_member', `suspend=${suspend.status}`, true)
        if (reactivate.status === 200 && restoredRow?.status === 'active') pass('membership_reactivate_temp_member', undefined, true)
        else fail('membership_reactivate_temp_member', `reactivate=${reactivate.status}`, true)
      } finally {
        if (tempMemberCreated) {
          await adminDb.from('membership_roles').delete().eq('membership_id', tempMembershipId)
          await adminDb.from('organization_memberships').delete().eq('id', tempMembershipId)
          await adminDb.from('user_profiles').delete().eq('id', tempProfileId)
        }
      }
    } else fail('membership_suspend_test', 'organization not found')

    const { count: syncRows } = await adminDb
      .from('evidence_bundle_sync_registrations')
      .select('*', { count: 'exact', head: true })
    const { count: submissionRows } = await adminDb
      .from('evidence_submissions')
      .select('*', { count: 'exact', head: true })
    const { count: uploadRows } = await adminDb
      .from('evidence_upload_sessions')
      .select('*', { count: 'exact', head: true })
    const { count: smokeInvites } = await adminDb
      .from('organization_invitations')
      .select('*', { count: 'exact', head: true })
      .like('email_normalized', '%8b7f4-smoke%')

    if ((syncRows ?? 0) === 0) pass('no_field_sync_residual_rows')
    else fail('no_field_sync_residual_rows', `count=${syncRows}`)
    if ((submissionRows ?? 0) === 0) pass('no_evidence_submissions_created')
    else fail('no_evidence_submissions_created', `count=${submissionRows}`)
    if ((uploadRows ?? 0) === 0) pass('no_upload_sessions_created')
    else fail('no_upload_sessions_created', `count=${uploadRows}`)
    if ((smokeInvites ?? 0) === 0) pass('no_smoke_invitations_residual')
    else fail('no_smoke_invitations_residual', `count=${smokeInvites}`)
  } finally {
    if (invitationId) {
      const admin = getSupabaseAdmin()
      await admin.from('organization_invitations').delete().eq('id', invitationId)
    }
  }
}

async function runReport(projectRef: string): Promise<void> {
  resetSupabaseClient()
  const admin = getSupabaseAdmin()
  const { verified } = await verifyRemoteMigrations()

  const tables = [
    'organizations',
    'user_profiles',
    'organization_memberships',
    'organization_invitations',
    'platform_bootstrap_runs',
    'evidence_upload_sessions',
    'evidence_bundle_sync_registrations',
    'evidence_submissions',
  ] as const

  const counts: Record<string, number> = {}
  for (const table of tables) {
    const { count } = await admin.from(table).select('*', { count: 'exact', head: true })
    counts[table] = count ?? 0
  }

  const artifact = {
    phase: '8B.7F.4',
    generated_at: new Date().toISOString(),
    project_ref_masked: maskProjectRef(projectRef),
    migrations: verified.map((name) => ({ name, status: 'verified' })),
    counts,
    bootstrap_enabled: getBootstrapStatus().enabled,
    field_real_sync_enabled: false,
  }

  const outDir = resolve(process.cwd(), 'docs/reports')
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, '8B7F4-remote-status.json')
  writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
  pass('report_written', outPath)
}

async function printSummary(projectRef: string | null) {
  console.log(
    JSON.stringify(
      {
        phase: '8B.7F.4',
        project_ref_masked: projectRef ? maskProjectRef(projectRef) : null,
        checks,
        passed: checks.filter((c) => c.ok).length,
        failed: checks.filter((c) => !c.ok).length,
        mutating_checks: checks.filter((c) => c.mutates).map((c) => c.name),
      },
      null,
      2,
    ),
  )
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  let projectRef: string | null = null

  if (options.mode === 'preflight') {
    await runPreflight()
    await printSummary(null)
    process.exit(checks.some((c) => !c.ok) ? 1 : 0)
  }

  projectRef = assertRemoteConfirmation(options)
  requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  if (options.mode === 'apply' || options.mode === 'full') await runApplyVerify()
  if (options.mode === 'bootstrap' || options.mode === 'full') {
    const user = await resolveExistingAuthUser(options)
    await runBootstrap(user.authUserId, user.email)
  }
  if (options.mode === 'smoke' || options.mode === 'full') {
    requireEnv('SUPABASE_ANON_KEY')
    requireEnv('AUTH_TEST_EMAIL')
    requireEnv('AUTH_TEST_PASSWORD')
    try {
      await fetch(`${baseUrl()}/api/health`)
    } catch {
      fail('server_reachable', `start server on ${baseUrl()} before smoke tests`)
      await printSummary(projectRef)
      process.exit(1)
    }
    await runSmokeTests()
  }
  if (options.mode === 'report' || options.mode === 'full') {
    await runReport(projectRef)
  }

  await printSummary(projectRef)
  process.exit(checks.some((c) => !c.ok) ? 1 : 0)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
