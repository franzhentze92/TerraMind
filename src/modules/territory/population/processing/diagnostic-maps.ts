import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

import { runCommand } from '@/modules/territory/population/processing/gdal'
import {
  POPULATION_REPORTS_DIR,
  processedWgs84Cog,
} from '@/modules/territory/population/processing/paths'
import type { WorldPopVariant } from '@/modules/territory/population/providers/worldpop/worldpop-products'

export interface DiagnosticMapZone {
  slug: string
  name: string
  west: number
  south: number
  east: number
  north: number
}

export const DIAGNOSTIC_MAP_ZONES: readonly DiagnosticMapZone[] = [
  {
    slug: 'guatemala-city',
    name: 'Ciudad de Guatemala',
    west: -90.58,
    south: 14.58,
    east: -90.44,
    north: 14.7,
  },
  {
    slug: 'atitlan',
    name: 'Lago de Atitlán',
    west: -91.28,
    south: 14.62,
    east: -91.12,
    north: 14.76,
  },
  {
    slug: 'maya-biosphere',
    name: 'Reserva Biosfera Maya',
    west: -90.1,
    south: 17.4,
    east: -89.0,
    north: 18.0,
  },
  {
    slug: 'rural-huehuetenango',
    name: 'Comunidad rural dispersa',
    west: -91.55,
    south: 15.25,
    east: -91.4,
    north: 15.38,
  },
] as const

export interface DiagnosticMapResult {
  zone: string
  variant: WorldPopVariant
  outputPath: string
}

async function renderZoneVariant(
  zone: DiagnosticMapZone,
  variant: WorldPopVariant,
): Promise<DiagnosticMapResult> {
  const raster = processedWgs84Cog(variant)
  if (!existsSync(raster)) {
    throw new Error(`COG no encontrado: ${raster}`)
  }

  mkdirSync(POPULATION_REPORTS_DIR, { recursive: true })
  const outputPath = resolve(
    POPULATION_REPORTS_DIR,
    `${zone.slug}_${variant}_wgs84_preview.png`,
  )

  const res = await runCommand('gdal_translate', [
    '-of',
    'PNG',
    '-projwin',
    String(zone.west),
    String(zone.north),
    String(zone.east),
    String(zone.south),
    '-outsize',
    '512',
    '512',
    '-scale',
    raster,
    outputPath,
  ])
  if (res.exitCode !== 0) {
    throw new Error(`gdal_translate PNG falló (${zone.slug}/${variant}): ${res.stderr || res.stdout}`)
  }

  return { zone: zone.slug, variant, outputPath }
}

export async function generateWorldPopDiagnosticMaps(): Promise<DiagnosticMapResult[]> {
  const results: DiagnosticMapResult[] = []
  for (const zone of DIAGNOSTIC_MAP_ZONES) {
    for (const variant of ['constrained', 'unconstrained'] as const) {
      results.push(await renderZoneVariant(zone, variant))
    }
  }
  return results
}
