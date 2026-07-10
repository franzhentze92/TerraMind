#!/usr/bin/env tsx
import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { execSync } from 'node:child_process'

import { HDX_COD_AB_FILES, HDX_COD_AB_SOURCE_DIR } from '@/pipeline/geo/hdx-cod-ab'
import { INE_SOURCE_INVENTORY } from '@/modules/territory/population/providers/ine/ine-sources-inventory'

const baseDir = resolve(process.cwd(), HDX_COD_AB_SOURCE_DIR)
const zipPath = resolve(baseDir, HDX_COD_AB_FILES.zip)
const extractedDir = resolve(baseDir, 'extracted')

function ensureHdxExtracted(): string[] {
  const messages: string[] = []
  const targets = [HDX_COD_AB_FILES.adm0, HDX_COD_AB_FILES.adm1]
  const missing = targets.filter((rel) => !existsSync(resolve(baseDir, rel)))
  if (missing.length === 0) return messages

  if (!existsSync(zipPath)) {
    messages.push(
      `Falta ${HDX_COD_AB_FILES.zip}. Descargar desde https://data.humdata.org/dataset/cod-ab-gtm`,
    )
    return messages
  }

  mkdirSync(extractedDir, { recursive: true })
  if (process.platform === 'win32') {
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${extractedDir.replace(/'/g, "''")}' -Force"`,
      { stdio: 'inherit' },
    )
  } else {
    execSync(`unzip -o "${zipPath}" -d "${extractedDir}"`, { stdio: 'inherit' })
  }
  messages.push(`Extraído ${HDX_COD_AB_FILES.zip} → extracted/`)
  return messages
}

async function main() {
  const actions = ensureHdxExtracted()
  console.log(
    JSON.stringify(
      {
        action: 'population:download-ine',
        ineSources: INE_SOURCE_INVENTORY.map((s) => ({
          id: s.id,
          name: s.name,
          url: s.url,
          referenceYear: s.referenceYear,
        })),
        hdxAdminPoints: existsSync(resolve(baseDir, 'extracted/gtm_adminpoints.geojson')),
        hdxAdm1: existsSync(resolve(baseDir, HDX_COD_AB_FILES.adm1)),
        actions,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
