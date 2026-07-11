#!/usr/bin/env tsx
/**
 * 8C.1 — HTTP smoke against live TerraMind API (non-destructive).
 * Requires server running with AUTH_ENFORCE=true.
 *
 * Modes:
 *   test-tokens  AUTH_TEST_MODE=1 (default for CI/local)
 *   real-auth    AUTH_TEST_EMAIL + AUTH_TEST_PASSWORD
 *
 * Example:
 *   npm run response-orchestration:http-smoke
 *   npm run response-orchestration:http-smoke -- --mode=real-auth
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:net'
import { config } from 'dotenv'
import { resolve } from 'node:path'

import { createClient } from '@supabase/supabase-js'

config({ path: resolve(process.cwd(), '.env') })

type SmokeMode = 'test-tokens' | 'real-auth'

interface Check {
  name: string
  ok: boolean
  detail?: string
}

const checks: Check[] = []
const MISSING_UUID = '00000000-0000-4000-a07f-000000009999'
const CROSS_TENANT_INCIDENT = '00000000-0000-4000-a07f-00000000e001'
const LEGACY_INCIDENT_FIXTURE = '00000000-0000-4000-a07f-00000000e099'

function pass(name: string, detail?: string) {
  checks.push({ name, ok: true, detail })
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`)
}

function fail(name: string, detail?: string) {
  checks.push({ name, ok: false, detail })
  console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
}

function baseUrl(): string {
  return (process.env.TERRAMIND_API_URL ?? `http://localhost:${process.env.TERRAMIND_PORT ?? 3001}`).replace(/\/$/, '')
}

async function api(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: unknown }> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.token) headers.set('Authorization', `Bearer ${init.token}`)
  const res = await fetch(`${baseUrl()}${path}`, { ...init, headers })
  const text = await res.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }
  return { status: res.status, body }
}

let serverProc: ChildProcess | null = null

async function findFreePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const probe = createServer()
    probe.listen(0, () => {
      const addr = probe.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      probe.close((err) => (err ? reject(err) : resolvePort(port)))
    })
    probe.on('error', reject)
  })
}

async function waitForApiReady(timeoutMs = 25_000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const health = await api('/api/health')
      const worker = await api('/api/pipeline/response-orchestration/status')
      if (health.status === 200 && worker.status === 200) return true
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

async function ensureServer(): Promise<void> {
  const smokePort =
    process.env.RESPONSE_SMOKE_PORT ?? String(await findFreePort())
  process.env.TERRAMIND_API_URL = `http://localhost:${smokePort}`

  if (serverProc) {
    serverProc.kill('SIGTERM')
    serverProc = null
    await new Promise((r) => setTimeout(r, 500))
  }

  pass('server_spawn', `starting tsx server/index.ts on :${smokePort}`)
  serverProc = spawn('npx', ['tsx', 'server/index.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AUTH_ENFORCE: 'true',
      AUTH_TEST_MODE: '1',
      FIRE_PIPELINE_ENABLED: 'false',
      RESPONSE_ORCHESTRATION_WORKER_ENABLED: 'true',
      TERRAMIND_PORT: smokePort,
      TERRAMIND_API_URL: `http://localhost:${smokePort}`,
    },
    stdio: 'pipe',
    shell: true,
  })

  const ok = await waitForApiReady(30_000)
  if (!ok) fail('server_startup')
  else pass('server_startup')
}

async function resolveToken(mode: SmokeMode): Promise<{ admin: string; viewer: string | null }> {
  if (mode === 'test-tokens') {
    return { admin: 'test-org-admin-org-a', viewer: 'test-tech-org-a' }
  }

  const email = process.env.AUTH_TEST_EMAIL?.trim()
  const password = process.env.AUTH_TEST_PASSWORD?.trim()
  if (!email || !password) throw new Error('AUTH_TEST_EMAIL and AUTH_TEST_PASSWORD required for real-auth mode')

  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.session?.access_token) throw new Error(`sign_in_failed:${error?.message}`)
  return { admin: data.session.access_token, viewer: null }
}

async function findLegacyIncidentId(): Promise<string | null> {
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data } = await admin.from('incidents').select('id').is('organization_id', null).limit(1).maybeSingle()
  return data?.id ? String(data.id) : null
}

async function runSmoke(mode: SmokeMode): Promise<void> {
  console.log(`Response Orchestration HTTP Smoke (${mode})\n`)

  await ensureServer()

  const workerStatus = await api('/api/pipeline/response-orchestration/status')
  if (workerStatus.status === 200) pass('worker_health_endpoint')
  else fail('worker_health_endpoint', `status=${workerStatus.status}`)

  if ((await api('/api/responses')).status === 401) pass('list_unauthenticated_401')
  else fail('list_unauthenticated_401')

  if ((await api('/api/responses', { token: 'invalid.jwt.token' })).status === 401) {
    pass('list_invalid_token_401')
  } else fail('list_invalid_token_401')

  const tokens = await resolveToken(mode)
  pass('auth_token_resolved', mode)

  const list = await api('/api/responses', { token: tokens.admin })
  if (list.status === 200) pass('list_authenticated_200')
  else fail('list_authenticated_200', `status=${list.status}`)

  const listBody = list.body as { items?: unknown[] }
  if (Array.isArray(listBody.items)) pass('list_org_scoped_shape')
  else fail('list_org_scoped_shape')

  const missing = await api(`/api/responses/${MISSING_UUID}`, { token: tokens.admin })
  if (missing.status === 404 || missing.status === 403) pass('missing_incident_safe', `status=${missing.status}`)
  else fail('missing_incident_safe', `status=${missing.status}`)

  const cross = await api(`/api/responses/${CROSS_TENANT_INCIDENT}`, { token: tokens.viewer ?? 'test-tech-org-b' })
  if (cross.status === 403 || cross.status === 404) pass('cross_tenant_rejected', `status=${cross.status}`)
  else fail('cross_tenant_rejected', `status=${cross.status}`)

  if (tokens.viewer) {
    const noPerm = await api('/api/responses/decisions/00000000-0000-4000-a07f-00000000d100/approve', {
      method: 'POST',
      token: tokens.viewer,
    })
    if (noPerm.status === 403) pass('viewer_approve_403')
    else fail('viewer_approve_403', `status=${noPerm.status}`)
  } else {
    pass('viewer_approve_403', 'skipped — real-auth admin only')
  }

  const legacyId =
    mode === 'test-tokens' ? LEGACY_INCIDENT_FIXTURE : await findLegacyIncidentId()
  if (legacyId) {
    const legacy = await api(`/api/responses/${legacyId}`, { token: tokens.admin })
    const body = legacy.body as { ownership_unresolved?: boolean }
    if (legacy.status === 200 && body.ownership_unresolved) pass('legacy_incident_ownership_unresolved')
    else fail('legacy_incident_ownership_unresolved', `status=${legacy.status}`)
  } else {
    pass('legacy_incident_ownership_unresolved', 'no legacy incident in DB — skipped')
  }

  const execSummary = await api('/api/responses/executive-summary', { token: tokens.admin })
  if (execSummary.status === 200) pass('executive_summary_200')
  else fail('executive_summary_200', `status=${execSummary.status}`)

  const assessReject = await api(`/api/responses/${MISSING_UUID}/assess`, {
    method: 'POST',
    token: tokens.admin,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idempotency_key: randomUUID() }),
  })
  if ([403, 404].includes(assessReject.status)) pass('assess_missing_incident_rejected', `status=${assessReject.status}`)
  else fail('assess_missing_incident_rejected', `status=${assessReject.status}`)

  if (legacyId) {
    const brief = await api(`/api/responses/${legacyId}/briefing`, { token: tokens.admin })
    const briefBody = brief.body as { ownership_unresolved?: boolean }
    if (brief.status === 200 && briefBody.ownership_unresolved) pass('briefing_legacy_200')
    else fail('briefing_legacy_200', `status=${brief.status}`)

    const hist = await api(`/api/responses/${legacyId}/history`, { token: tokens.admin })
    if (hist.status === 200) pass('history_legacy_200')
    else fail('history_legacy_200', `status=${hist.status}`)
  }

  const closure = await api(`/api/responses/${MISSING_UUID}/closure-assessment`, { token: tokens.admin })
  if ([403, 404].includes(closure.status)) pass('closure_missing_rejected', `status=${closure.status}`)
  else fail('closure_missing_rejected', `status=${closure.status}`)

  console.log('\n--- Summary ---')
  const failed = checks.filter((c) => !c.ok)
  if (failed.length === 0) {
    console.log(`SMOKE PASSED — ${checks.length} checks`)
    return
  }
  console.log(`SMOKE FAILED — ${failed.length}/${checks.length}`)
  for (const f of failed) console.log(`  - ${f.name}: ${f.detail ?? ''}`)
  process.exitCode = 1
}

function parseMode(): SmokeMode {
  const arg = process.argv.find((a) => a.startsWith('--mode='))
  return (arg?.slice('--mode='.length) ?? 'test-tokens') as SmokeMode
}

runSmoke(parseMode())
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => {
    if (serverProc) {
      serverProc.kill('SIGTERM')
    }
  })
