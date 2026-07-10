import { createWriteStream, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'

import { getToolVersions } from '@/modules/territory/population/processing/gdal'
import {
  loadPopulationManifest,
  POPULATION_MANIFEST_VERSION,
  savePopulationManifest,
  sha256File,
  writeSha256Sums,
  type PopulationManifest,
} from '@/modules/territory/population/processing/manifest-io'
import {
  POPULATION_RAW_DIR,
  POPULATION_SHA256SUMS,
  POPULATION_SOURCE_MD,
  POPULATION_WORLDPOP_SOURCE_DIR,
  rawRasterPath,
} from '@/modules/territory/population/processing/paths'
import {
  WORLDPOP_PRODUCTS_2020,
  type WorldPopVariant,
} from '@/modules/territory/population/providers/worldpop/worldpop-products'

async function downloadFile(url: string, dest: string): Promise<void> {
  const temp = `${dest}.part`
  if (existsSync(temp)) unlinkSync(temp)

  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok || !res.body) {
    throw new Error(`Descarga fallida ${url}: HTTP ${res.status}`)
  }
  await pipeline(res.body as unknown as NodeJS.ReadableStream, createWriteStream(temp))

  const size = statSync(temp).size
  if (size < 1_000_000) {
    unlinkSync(temp)
    throw new Error(`Descarga incompleta (${size} bytes) desde ${url}`)
  }

  if (existsSync(dest)) unlinkSync(dest)
  renameSync(temp, dest)
}

function buildSourceMarkdown(manifest: PopulationManifest): string {
  const lines = [
    '# WorldPop Guatemala 2020 — fuente local',
    '',
    'Descargado para auditoría 7D.1A. **No commitear rasters.**',
    '',
    '| Variante | URL oficial | Versión | Año | Unidad | CRS | Licencia |',
    '|----------|-------------|---------|-----|--------|-----|----------|',
    ...WORLDPOP_PRODUCTS_2020.map(
      (p) =>
        `| ${p.modelType} | ${p.officialUrl} | ${p.sourceVersion} | ${p.referenceYear} | ${p.unit} | ${p.crs} | ${p.license} |`,
    ),
    '',
    `Manifest: \`${POPULATION_MANIFEST_VERSION}\``,
    `Última descarga: ${manifest.downloads.find((d) => d.downloaded_at)?.downloaded_at ?? 'pendiente'}`,
    '',
    '## Política de reconciliación INE',
    '',
    'WorldPop 2020 se compara con **proyección INE 2020**, no con Censo 2018 directamente.',
    'Sin proyección municipal válida → `adjustment_not_applied`.',
  ]
  return `${lines.join('\n')}\n`
}

export interface DownloadWorldPopResult {
  downloads: Array<{
    variant: WorldPopVariant
    status: string
    size_bytes: number
    sha256: string
    skipped: boolean
    duration_ms: number
  }>
  total_bytes: number
  total_duration_ms: number
}

export async function downloadWorldPopRasters(): Promise<DownloadWorldPopResult> {
  const started = Date.now()
  mkdirSync(POPULATION_RAW_DIR, { recursive: true })
  mkdirSync(POPULATION_WORLDPOP_SOURCE_DIR, { recursive: true })

  const manifest: PopulationManifest = existsSync(resolve(POPULATION_WORLDPOP_SOURCE_DIR, 'manifest.json'))
    ? loadPopulationManifest()
    : {
        manifest_version: POPULATION_MANIFEST_VERSION,
        reference_year: 2020,
        adjustment_policy:
          'Reconciliar solo con proyección INE del mismo año del raster; sin proyección municipal válida → sin ajuste.',
        downloads: WORLDPOP_PRODUCTS_2020.map((p) => ({
          variant: p.variant,
          official_url: p.officialUrl,
          local_path: `raw/${p.localFilename}`,
          expected_size_bytes: p.expectedSizeBytes,
          status: 'pending' as const,
        })),
      }

  manifest.tools = await getToolVersions()
  const results: DownloadWorldPopResult['downloads'] = []
  let totalBytes = 0

  for (const product of WORLDPOP_PRODUCTS_2020) {
    const dest = rawRasterPath(product.variant)
    const entry = manifest.downloads.find((d) => d.variant === product.variant)
    if (!entry) continue

    const tileStarted = Date.now()
    let skipped = false

    if (existsSync(dest)) {
      const size = statSync(dest).size
      const hash = await sha256File(dest)
      const expectedHash = entry.sha256
      const sizeOk = size >= product.expectedSizeBytes * 0.98
      if (expectedHash && hash === expectedHash && sizeOk) {
        skipped = true
        entry.size_bytes_actual = size
        entry.sha256 = hash
        entry.status = 'downloaded'
        results.push({
          variant: product.variant,
          status: 'skipped_checksum',
          size_bytes: size,
          sha256: hash,
          skipped: true,
          duration_ms: Date.now() - tileStarted,
        })
        totalBytes += size
        continue
      }
    }

    await downloadFile(product.officialUrl, dest)
    const size = statSync(dest).size
    const hash = await sha256File(dest)
    entry.size_bytes_actual = size
    entry.sha256 = hash
    entry.status = 'downloaded'
    entry.downloaded_at = new Date().toISOString()

    results.push({
      variant: product.variant,
      status: 'downloaded',
      size_bytes: size,
      sha256: hash,
      skipped: false,
      duration_ms: Date.now() - tileStarted,
    })
    totalBytes += size
  }

  manifest.download_completed_at = new Date().toISOString()
  manifest.download_duration_ms = Date.now() - started
  savePopulationManifest(manifest)

  writeSha256Sums(
    results.map((r) => ({
      path: rawRasterPath(r.variant),
      sha256: r.sha256,
      label: `raw/${r.variant}`,
    })),
    POPULATION_SHA256SUMS,
  )

  const { writeFileSync } = await import('node:fs')
  writeFileSync(POPULATION_SOURCE_MD, buildSourceMarkdown(manifest), 'utf8')

  return {
    downloads: results,
    total_bytes: totalBytes,
    total_duration_ms: Date.now() - started,
  }
}
