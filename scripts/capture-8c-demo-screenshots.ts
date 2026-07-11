#!/usr/bin/env tsx
/**
 * 8C.DEMO — UI screenshots with AUTH_TEST_MODE test tokens (no real credentials).
 * Spawns backend + Vite preview on free ports, injects test bearer session, captures routes.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { config } from 'dotenv'
import { chromium, type Browser, type Page } from 'playwright'

config({ path: resolve(process.cwd(), '.env') })

const demosOnly = process.argv.includes('--demos-only')

const TEST_TOKEN = 'test-org-admin-org-a'
const DEMO_INCIDENT = '8cd9487a-6823-43d6-b186-3166165db05a'
const OUT = join(process.cwd(), 'artifacts/reports/8C.DEMO/screenshots')

const VIEWPORTS = {
  desktop: { width: 1440, height: 1000 },
  tablet: { width: 1024, height: 1366 },
  mobile: { width: 390, height: 844 },
} as const

let serverProc: ChildProcess | null = null
let previewProc: ChildProcess | null = null
let apiPort = 0
let previewPort = 0
let previewBase = ''

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

function spawnProc(
  command: string,
  args: string[],
  env: Record<string, string | undefined>,
): ChildProcess {
  return spawn(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: 'pipe',
    shell: true,
  })
}

async function waitForHttp(url: string, timeoutMs = 45_000): Promise<void> {
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

async function ensureDistBuild(): Promise<void> {
  const index = join(process.cwd(), 'dist/index.html')
  if (existsSync(index)) return
  console.log('Building frontend (dist missing)…')
  await runCommand('npx', ['vite', 'build'])
}

async function runCommand(cmd: string, args: string[]): Promise<void> {
  await new Promise<void>((resolveCmd, reject) => {
    const proc = spawn(cmd, args, { cwd: process.cwd(), shell: true, stdio: 'inherit' })
    proc.on('exit', (code) => (code === 0 ? resolveCmd() : reject(new Error(`${cmd} exit ${code}`))))
  })
}

async function startBackend(): Promise<void> {
  apiPort = await findFreePort()
  const apiUrl = `http://127.0.0.1:${apiPort}`
  console.log(`Starting API on ${apiUrl} (AUTH_TEST_MODE=1)`)
  serverProc = spawnProc('npx', ['tsx', 'server/index.ts'], {
    AUTH_ENFORCE: 'true',
    AUTH_TEST_MODE: '1',
    FIRE_PIPELINE_ENABLED: 'false',
    RESPONSE_ORCHESTRATION_WORKER_ENABLED: 'false',
    TERRAMIND_PORT: String(apiPort),
  })
  await waitForHttp(`${apiUrl}/api/health`)

  const me = await fetch(`${apiUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${TEST_TOKEN}` },
  })
  if (!me.ok) throw new Error(`Test token rejected: /api/auth/me ${me.status}`)
  console.log('  ✓ test token accepted by /api/auth/me')
}

async function startPreview(): Promise<void> {
  previewPort = await findFreePort()
  previewBase = `http://127.0.0.1:${previewPort}`
  const apiUrl = `http://127.0.0.1:${apiPort}`
  console.log(`Starting preview on ${previewBase} → API ${apiUrl}`)
  previewProc = spawnProc('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(previewPort)], {
    TERRAMIND_API_URL: apiUrl,
  })
  await waitForHttp(`${previewBase}/`)
}

function killProc(proc: ChildProcess | null) {
  if (proc && !proc.killed) proc.kill('SIGTERM')
}

async function injectTestSession(page: Page) {
  await page.addInitScript((token: string) => {
    localStorage.setItem(
      'terramind-auth-v1',
      JSON.stringify({
        state: {
          accessToken: token,
          authContext: null,
          organizations: [],
          pendingSyncWarning: false,
        },
        version: 0,
      }),
    )
  }, TEST_TOKEN)
}

async function gotoApp(page: Page, path: string) {
  await page.goto(`${previewBase}${path}`, { waitUntil: 'load', timeout: 60_000 })
  await page.waitForTimeout(800)
}

async function waitForAppShell(page: Page) {
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45_000 })
  await page.waitForSelector('aside, nav', { timeout: 25_000 })
}

async function waitForExecutiveDashboard(page: Page) {
  await page.getByText('Observaciones FIRMS').first().waitFor({ timeout: 90_000 })
  await waitForExecutiveReady(page)
}

async function waitForExecutiveReady(page: Page) {
  await page.getByText('Cargando centro de mando ejecutivo').waitFor({ state: 'hidden', timeout: 90_000 }).catch(() => null)
  await page.waitForTimeout(600)
}

async function scrollToExecutive(page: Page) {
  await waitForExecutiveReady(page)
  await page.evaluate(() => {
    const firms = [...document.querySelectorAll('*')].find((el) =>
      el.textContent?.trim().startsWith('Observaciones FIRMS'),
    )
    firms?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
    const toggle = document.querySelector('input[aria-label="Mostrar demostraciones"]')
    toggle?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
  })
  await page.waitForTimeout(900)
}

async function scrollToDemoBanner(page: Page) {
  await page.evaluate(() => {
    const banner = [...document.querySelectorAll('*')].find((el) =>
      el.textContent?.includes('Demostración interna'),
    )
    banner?.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior })
  })
  await page.waitForTimeout(900)
}

async function setDemoMode(page: Page, enabled: boolean) {
  await scrollToExecutive(page)
  const toggle = page.locator('input[aria-label="Mostrar demostraciones"]')
  await toggle.waitFor({ state: 'attached', timeout: 45_000 })
  const checked = await toggle.isChecked()
  if (checked !== enabled) {
    await toggle.click({ force: true, noWaitAfter: true })
    await waitForExecutiveReady(page)
    if (enabled) {
      await page.getByText('Demostración interna').waitFor({ timeout: 45_000 })
    } else {
      await page.getByText('Demostración interna').waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => null)
    }
    await scrollToExecutive(page)
  }
}

async function scrollToMap(page: Page) {
  await page.getByText('Mapa operacional').scrollIntoViewIfNeeded()
  await page.waitForTimeout(800)
  await page.locator('.leaflet-container').first().waitFor({ timeout: 45_000 })
  await page.getByText('Cargando mapa').waitFor({ state: 'hidden', timeout: 90_000 }).catch(() => null)
  await page.waitForTimeout(1500)
}

async function shot(page: Page, file: string, fullPage = true) {
  const path = join(OUT, file)
  await page.screenshot({ path, fullPage })
  console.log(`  ✓ ${file}`)
}

async function captureScreenshots(browser: Browser) {
  mkdirSync(OUT, { recursive: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  await injectTestSession(page)

  if (!demosOnly) {
  await gotoApp(page, '/situacion')
  await waitForAppShell(page)
  await waitForExecutiveDashboard(page)

  for (const [name, vp] of Object.entries(VIEWPORTS)) {
    await page.setViewportSize(vp)
    await gotoApp(page, '/situacion')
    await waitForExecutiveDashboard(page)
    await scrollToExecutive(page)
    await page.waitForTimeout(1000)
    await shot(page, `situacion-${name}.png`, false)
  }

  await page.setViewportSize(VIEWPORTS.desktop)
  await gotoApp(page, '/situacion')
  await waitForExecutiveDashboard(page)
  await scrollToMap(page)
  const map = page.locator('.leaflet-container').first()
  try {
    await map.click({ position: { x: 180, y: 160 }, timeout: 10_000 })
  } catch {
    /* panel optional if tiles still loading */
  }
  await page.waitForTimeout(1500)
  await shot(page, 'situacion-map-panel.png', false)

  await gotoApp(page, `/incidentes/${DEMO_INCIDENT}/historia`)
  await page.getByText('Cobertura de historia').waitFor({ timeout: 90_000 })
  await page.waitForTimeout(1000)
  await shot(page, 'incident-story.png')

  await gotoApp(page, '/informes')
  await page.waitForSelector('text=/Informes|Centro de informes/i', { timeout: 20_000 })
  await shot(page, 'reports-center.png')

  await gotoApp(page, '/informes/nacional')
  await page.waitForTimeout(2000)
  await shot(page, 'national-report-app.png')

  await gotoApp(page, `/informes/incidentes/${DEMO_INCIDENT}`)
  await page.waitForTimeout(2000)
  await shot(page, 'incident-report-app.png')

  await gotoApp(page, '/respuesta')
  await page.waitForTimeout(2000)
  await shot(page, 'response-empty-state.png')
  }

  await page.setViewportSize(VIEWPORTS.desktop)
  await gotoApp(page, '/situacion')
  await waitForExecutiveDashboard(page)
  await scrollToExecutive(page)
  await page.evaluate(() => {
    const input = document.querySelector('input[aria-label="Mostrar demostraciones"]') as HTMLInputElement | null
    if (input && !input.checked) input.click()
  })
  await waitForExecutiveReady(page)
  await page.getByText('Demostración interna').waitFor({ timeout: 45_000 })
  await scrollToDemoBanner(page)
  await shot(page, 'demo-enabled.png', false)

  await gotoApp(page, '/situacion')
  await waitForExecutiveDashboard(page)
  await scrollToExecutive(page)
  await page.evaluate(() => {
    const input = document.querySelector('input[aria-label="Mostrar demostraciones"]') as HTMLInputElement | null
    if (input?.checked) input.click()
  })
  await waitForExecutiveReady(page)
  await scrollToExecutive(page)
  await shot(page, 'demo-disabled.png', false)

  await context.close()
}

function verifyPdfSamples() {
  const national = join(process.cwd(), 'artifacts/reports/8C.DEMO/national-report.pdf')
  const incident = join(process.cwd(), 'artifacts/reports/8C.DEMO/incident-8cd9487a.pdf')
  for (const f of [national, incident]) {
    if (!existsSync(f)) continue
    const buf = readFileSync(f)
    const pages = (buf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length
    const textLen = buf.toString('latin1').replace(/[^\x20-\x7E\n]/g, '').length
    console.log(`  PDF ${f.split(/[/\\]/).pop()}: ${pages} pages, ${buf.length} bytes, ~${textLen} chars text`)
    if (pages < 2) throw new Error(`PDF too thin: ${f}`)
    if (textLen < 500) throw new Error(`PDF lacks readable content: ${f}`)
  }
}

async function main() {
  console.log('8C.DEMO screenshot capture (AUTH_TEST_MODE)\n')
  try {
    await ensureDistBuild()
    await startBackend()
    await startPreview()

    const browser = await chromium.launch({ headless: true })
    try {
      await captureScreenshots(browser)
    } finally {
      await browser.close()
    }

    console.log('\nVerifying PDF samples…')
    verifyPdfSamples()
    console.log('\nAll screenshots captured.')
  } finally {
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
