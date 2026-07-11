/**
 * CHIRPS v3 — download with idempotency manifest (GeoTIFF pentad, LATAM subset).
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { CHIRPS_V3_PROCESSING_VERSION } from '@/modules/precipitation/chirps-v3/chirps-v3.config'
import type { ChirpsPentadRef } from '@/modules/precipitation/chirps-v3/chirps-pentad.calendar'
import { chirpsPentadTifUrl, chirpsProductIdentity, type ChirpsVariant } from '@/modules/precipitation/chirps-v3/chirps-v3.urls'

export const CHIRPS_DATA_ROOT = resolve(process.cwd(), 'data/climate/chirps/v3')
export const CHIRPS_RAW_DIR = resolve(CHIRPS_DATA_ROOT, 'raw')
export const CHIRPS_MANIFEST_PATH = resolve(CHIRPS_DATA_ROOT, 'manifest.json')

export interface ChirpsIngestManifestEntry {
  productId: string
  variant: ChirpsVariant
  year: number
  month: number
  pentad: number
  url: string
  localPath: string
  sha256: string
  sizeBytes: number
  downloadedAt: string
  processingVersion: string
}

export interface ChirpsIngestManifest {
  version: number
  processingVersion: string
  products: ChirpsIngestManifestEntry[]
}

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

export function loadChirpsManifest(): ChirpsIngestManifest {
  if (!existsSync(CHIRPS_MANIFEST_PATH)) {
    return { version: 1, processingVersion: CHIRPS_V3_PROCESSING_VERSION, products: [] }
  }
  return JSON.parse(readFileSync(CHIRPS_MANIFEST_PATH, 'utf8')) as ChirpsIngestManifest
}

export function saveChirpsManifest(manifest: ChirpsIngestManifest): void {
  mkdirSync(dirname(CHIRPS_MANIFEST_PATH), { recursive: true })
  writeFileSync(CHIRPS_MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8')
}

export function localRawPath(ref: ChirpsPentadRef, variant: ChirpsVariant): string {
  const m = String(ref.month).padStart(2, '0')
  return resolve(CHIRPS_RAW_DIR, variant, String(ref.year), `${ref.year}.${m}.${ref.pentad}.tif`)
}

export interface DownloadResult {
  skipped: boolean
  path: string
  sha256: string
  sizeBytes: number
  url: string
}

/** Explicit, actionable download/processing error codes. */
export type ChirpsErrorCode =
  | 'DOWNLOAD_CONNECT_TIMEOUT'
  | 'DOWNLOAD_RESPONSE_TIMEOUT'
  | 'DOWNLOAD_TOTAL_TIMEOUT'
  | 'DOWNLOAD_HTTP_ERROR'
  | 'DOWNLOAD_EMPTY'
  | 'CHECKSUM_FAILED'

export class ChirpsDownloadError extends Error {
  readonly code: ChirpsErrorCode
  constructor(code: ChirpsErrorCode, message: string) {
    super(`[${code}] ${message}`)
    this.name = 'ChirpsDownloadError'
    this.code = code
  }
}

export interface DownloadTimeouts {
  /** Max ms to establish the connection + receive response headers. */
  responseTimeoutMs: number
  /** Max ms for the whole request (headers + body). */
  totalTimeoutMs: number
}

export const DEFAULT_DOWNLOAD_TIMEOUTS: DownloadTimeouts = {
  responseTimeoutMs: 20_000,
  totalTimeoutMs: 90_000,
}

const MIN_TIF_BYTES = 100_000

/**
 * Download a single CHIRPS pentad GeoTIFF with abort-based timeouts.
 *
 * Uses `fetch` + `arrayBuffer()` (files are a few MB) rather than streaming a
 * web ReadableStream through node's `pipeline`, which can hang on Windows/undici.
 */
export async function downloadChirpsPentadTif(
  ref: ChirpsPentadRef,
  variant: ChirpsVariant,
  options?: { force?: boolean; maxRetries?: number; timeouts?: Partial<DownloadTimeouts> },
): Promise<DownloadResult> {
  const url = chirpsPentadTifUrl(ref, variant)
  const dest = localRawPath(ref, variant)
  const productId = chirpsProductIdentity(ref, variant)
  const manifest = loadChirpsManifest()
  const existing = manifest.products.find((p) => p.productId === productId && p.processingVersion === CHIRPS_V3_PROCESSING_VERSION)
  if (!options?.force && existing && existsSync(dest)) {
    return { skipped: true, path: dest, sha256: existing.sha256, sizeBytes: existing.sizeBytes, url }
  }

  mkdirSync(dirname(dest), { recursive: true })
  const temp = `${dest}.part`
  if (existsSync(temp)) unlinkSync(temp)

  const timeouts: DownloadTimeouts = { ...DEFAULT_DOWNLOAD_TIMEOUTS, ...options?.timeouts }
  const maxRetries = options?.maxRetries ?? 3
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const totalTimer = setTimeout(() => controller.abort('DOWNLOAD_TOTAL_TIMEOUT'), timeouts.totalTimeoutMs)
    let responseTimer: NodeJS.Timeout | undefined = setTimeout(
      () => controller.abort('DOWNLOAD_RESPONSE_TIMEOUT'),
      timeouts.responseTimeoutMs,
    )
    try {
      const res = await fetch(url, { redirect: 'follow', signal: controller.signal })
      if (responseTimer) {
        clearTimeout(responseTimer)
        responseTimer = undefined
      }
      if (!res.ok || !res.body) {
        throw new ChirpsDownloadError('DOWNLOAD_HTTP_ERROR', `HTTP ${res.status} en ${url}`)
      }
      const bytes = Buffer.from(await res.arrayBuffer())
      if (bytes.byteLength < MIN_TIF_BYTES) {
        throw new ChirpsDownloadError('DOWNLOAD_EMPTY', `Archivo demasiado pequeño (${bytes.byteLength} bytes)`)
      }
      await writeFile(temp, bytes)
      if (existsSync(dest)) unlinkSync(dest)
      renameSync(temp, dest)
      const hash = sha256File(dest)
      const entry: ChirpsIngestManifestEntry = {
        productId,
        variant,
        year: ref.year,
        month: ref.month,
        pentad: ref.pentad,
        url,
        localPath: dest,
        sha256: hash,
        sizeBytes: bytes.byteLength,
        downloadedAt: new Date().toISOString(),
        processingVersion: CHIRPS_V3_PROCESSING_VERSION,
      }
      const next = manifest.products.filter((p) => p.productId !== productId)
      next.push(entry)
      saveChirpsManifest({ ...manifest, products: next })
      return { skipped: false, path: dest, sha256: hash, sizeBytes: bytes.byteLength, url }
    } catch (err) {
      if (isAbortError(err)) {
        const reason = String((controller.signal as { reason?: unknown }).reason ?? 'DOWNLOAD_TOTAL_TIMEOUT')
        const code: ChirpsErrorCode =
          reason === 'DOWNLOAD_RESPONSE_TIMEOUT' ? 'DOWNLOAD_RESPONSE_TIMEOUT' : 'DOWNLOAD_TOTAL_TIMEOUT'
        lastError = new ChirpsDownloadError(code, `Descarga abortada por timeout (${reason}) en ${url}`)
      } else {
        lastError = err instanceof Error ? err : new Error(String(err))
      }
      if (existsSync(temp)) unlinkSync(temp)
      if (attempt < maxRetries) await new Promise((r) => setTimeout(r, attempt * 500))
    } finally {
      if (responseTimer) clearTimeout(responseTimer)
      clearTimeout(totalTimer)
    }
  }
  throw lastError ?? new ChirpsDownloadError('DOWNLOAD_TOTAL_TIMEOUT', `Descarga fallida: ${url}`)
}

function isAbortError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === 'AbortError' || err.name === 'TimeoutError' || /abort/i.test(err.message))
  )
}

/** Probe whether a pentad file exists on the official server (HEAD). */
export async function probeChirpsUrl(
  url: string,
  timeoutMs = 15_000,
): Promise<{ ok: boolean; status: number; contentLength?: number }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort('probe-timeout'), timeoutMs)
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal })
    const len = res.headers.get('content-length')
    return { ok: res.ok, status: res.status, contentLength: len ? Number(len) : undefined }
  } catch {
    return { ok: false, status: 0 }
  } finally {
    clearTimeout(timer)
  }
}
