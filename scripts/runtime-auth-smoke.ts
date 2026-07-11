#!/usr/bin/env tsx
/**
 * Runtime auth smoke — real Supabase login through the same UI AuthProvider uses.
 * Requires: backend (AUTH_ENFORCE=true), Vite preview/dev, AUTH_TEST_EMAIL + AUTH_TEST_PASSWORD.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import { chromium } from 'playwright'

config({ path: resolve(process.cwd(), '.env') })

const EMAIL = process.env.AUTH_TEST_EMAIL?.trim()
const PASSWORD = process.env.AUTH_TEST_PASSWORD?.trim()

const ROUTES = [
  '/situacion',
  '/hallazgos',
  '/prioridades',
  '/incidentes',
  '/verificaciones',
  '/misiones',
  '/operaciones/asignaciones',
  '/informes',
  '/respuesta',
]

let serverProc: ChildProcess | null = null
let previewProc: ChildProcess | null = null

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

function spawnProc(command: string, args: string[], env: Record<string, string | undefined>) {
  return spawn(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: 'pipe',
    shell: true,
  })
}

async function waitForHttp(url: string, timeoutMs = 45_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error(`Timeout waiting for ${url}`)
}

function killProc(proc: ChildProcess | null) {
  if (proc && !proc.killed) proc.kill('SIGTERM')
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    throw new Error('Set AUTH_TEST_EMAIL and AUTH_TEST_PASSWORD in .env for runtime auth smoke.')
  }
  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.')
  }

  const apiPort = await findFreePort()
  const previewPort = await findFreePort()
  const previewBase = `http://127.0.0.1:${previewPort}`

  serverProc = spawnProc('npx', ['tsx', 'server/index.ts'], {
    AUTH_ENFORCE: 'true',
    AUTH_TEST_MODE: '0',
    TERRAMIND_PORT: String(apiPort),
  })
  await waitForHttp(`http://127.0.0.1:${apiPort}/api/health`)

  previewProc = spawnProc('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(previewPort)], {
    TERRAMIND_API_URL: `http://127.0.0.1:${apiPort}`,
  })
  await waitForHttp(`${previewBase}/`)

  const browser = await chromium.launch({ headless: true })
  const unauthorized: string[] = []
  const consoleErrors: string[] = []

  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('response', (res) => {
      if (res.status() === 401 && res.url().includes('/api/')) unauthorized.push(res.url())
    })

    await page.goto(`${previewBase}/situacion`, { waitUntil: 'load' })
    await page.waitForURL(/\/login/, { timeout: 20_000 })

    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForURL(/\/situacion/, { timeout: 45_000 })

    const me = await page.evaluate(async () => {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      return { status: res.status }
    })
    if (me.status !== 200) throw new Error(`/api/auth/me returned ${me.status} after login`)

    for (const route of ROUTES) {
      unauthorized.length = 0
      await page.goto(`${previewBase}${route}`, { waitUntil: 'load', timeout: 60_000 })
      await page.waitForTimeout(1500)
      if (unauthorized.length > 0) {
        throw new Error(`401 on ${route}: ${unauthorized.join(', ')}`)
      }
    }

    await page.reload({ waitUntil: 'load' })
    await page.waitForTimeout(1500)
    if (page.url().includes('/login')) throw new Error('Session not restored after reload')

    const depthError = consoleErrors.find((e) => e.includes('Maximum update depth exceeded'))
    if (depthError) throw new Error(`Console error: ${depthError}`)

    console.log('runtime-auth-smoke OK')
    console.log(`  routes checked: ${ROUTES.length}`)
    console.log(`  console errors: ${consoleErrors.length}`)
  } finally {
    await browser.close()
    killProc(previewProc)
    killProc(serverProc)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  killProc(previewProc)
  killProc(serverProc)
  process.exit(1)
})
