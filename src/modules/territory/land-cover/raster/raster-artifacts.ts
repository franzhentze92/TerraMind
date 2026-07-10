import { createReadStream, existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import {
  LAND_COVER_ANALYTIC_COG,
  LAND_COVER_SHA256SUMS,
  LAND_COVER_SOURCE_COG,
} from '@/modules/territory/land-cover/processing/paths'

export interface RasterArtifactHashes {
  sourceCog: string
  analyticCog: string
}

export interface RasterArtifactStatus {
  sourceCogExists: boolean
  analyticCogExists: boolean
  sourceCogSha256: string | null
  analyticCogSha256: string | null
  expectedHashes: RasterArtifactHashes | null
  hashMismatch: boolean
}

export function parseSha256Sums(content: string): RasterArtifactHashes | null {
  const lines = content.trim().split('\n')
  let sourceCog: string | null = null
  let analyticCog: string | null = null
  for (const line of lines) {
    const [hash, label] = line.trim().split(/\s{2,}/)
    if (!hash || !label) continue
    if (label.endsWith('land_cover_gt_4326.tif')) sourceCog = hash
    if (label.endsWith('land_cover_gt_laea.tif')) analyticCog = hash
  }
  if (!sourceCog || !analyticCog) return null
  return { sourceCog, analyticCog }
}

export function loadExpectedRasterHashes(): RasterArtifactHashes | null {
  if (!existsSync(LAND_COVER_SHA256SUMS)) return null
  return parseSha256Sums(readFileSync(LAND_COVER_SHA256SUMS, 'utf8'))
}

export async function sha256File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(path)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

export async function verifyRasterArtifacts(): Promise<RasterArtifactStatus> {
  const expected = loadExpectedRasterHashes()
  const sourceCogExists = existsSync(LAND_COVER_SOURCE_COG)
  const analyticCogExists = existsSync(LAND_COVER_ANALYTIC_COG)
  const sourceCogSha256 = sourceCogExists ? await sha256File(LAND_COVER_SOURCE_COG) : null
  const analyticCogSha256 = analyticCogExists ? await sha256File(LAND_COVER_ANALYTIC_COG) : null

  const hashMismatch =
    expected != null &&
    ((sourceCogSha256 != null && sourceCogSha256 !== expected.sourceCog) ||
      (analyticCogSha256 != null && analyticCogSha256 !== expected.analyticCog))

  return {
    sourceCogExists,
    analyticCogExists,
    sourceCogSha256,
    analyticCogSha256,
    expectedHashes: expected,
    hashMismatch,
  }
}

export function assertRasterArtifactsReady(status: RasterArtifactStatus): void {
  if (!status.sourceCogExists || !status.analyticCogExists) {
    throw new Error('Raster nacional no disponible — ejecutar land-cover:build')
  }
  if (status.hashMismatch) {
    throw new Error('Hash SHA-256 del raster no coincide con SHA256SUMS')
  }
}
