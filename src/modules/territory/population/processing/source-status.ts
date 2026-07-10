import { existsSync } from 'node:fs'

import {
  loadPopulationManifest,
  sha256File,
} from '@/modules/territory/population/processing/manifest-io'
import {
  POPULATION_MANIFEST_PATH,
  processedLaeaCog,
  processedWgs84Cog,
  rawRasterPath,
} from '@/modules/territory/population/processing/paths'
import { inspectPopulationRaster } from '@/modules/territory/population/processing/raster-stats'
import { populationWarning } from '@/modules/territory/population/population-warnings'
import type { PopulationSourceStatus, PopulationWarning } from '@/modules/territory/population/population.types'
import { getWorldPopProduct } from '@/modules/territory/population/providers/worldpop/worldpop-products'

export interface LocalPopulationSourceStatus extends PopulationSourceStatus {
  filesAvailable: boolean
  checksumValid: boolean
  cogValid: boolean
  totalPopulation?: number
  primaryVariant?: 'constrained' | 'unconstrained' | 'dual_use'
  generatedAt?: string
}

export async function getLocalPopulationSourceStatus(): Promise<LocalPopulationSourceStatus> {
  const warnings: PopulationWarning[] = []
  const product = getWorldPopProduct('constrained')

  const rawPath = rawRasterPath('constrained')
  const wgs84Cog = processedWgs84Cog('constrained')
  const laeaCog = processedLaeaCog('constrained')

  const filesAvailable =
    existsSync(rawPath) && existsSync(wgs84Cog) && existsSync(laeaCog)

  let checksumValid = false
  if (existsSync(POPULATION_MANIFEST_PATH)) {
    try {
      const manifest = loadPopulationManifest()
      const entry = manifest.downloads.find((d) => d.variant === 'constrained')
      if (entry?.sha256 && existsSync(rawPath)) {
        checksumValid = (await sha256File(rawPath)) === entry.sha256
      }
      if (!checksumValid && entry?.sha256) {
        warnings.push(
          populationWarning('source_unavailable', 'Checksum constrained no coincide con manifest.'),
        )
      }
    } catch {
      warnings.push(populationWarning('source_unavailable', 'Manifest inválido o ausente.'))
    }
  } else {
    warnings.push(populationWarning('source_unavailable', 'Manifest de población no encontrado.'))
  }

  let cogValid = false
  let totalPopulation: number | undefined
  if (filesAvailable) {
    try {
      const inspection = await inspectPopulationRaster(wgs84Cog)
      cogValid = inspection.crs === 'EPSG:4326' && inspection.populationSum > 0
      totalPopulation = inspection.populationSum
    } catch {
      warnings.push(
        populationWarning('raster_processing_failed', 'No se pudo inspeccionar COG constrained.'),
      )
    }
  } else {
    warnings.push(
      populationWarning('source_unavailable', 'Archivos locales WorldPop incompletos.'),
    )
  }

  let primaryVariant: 'constrained' | 'unconstrained' | 'dual_use' | undefined
  let generatedAt: string | undefined
  if (existsSync(POPULATION_MANIFEST_PATH)) {
    const manifest = loadPopulationManifest()
    primaryVariant = manifest.recommended_primary_variant
    generatedAt = manifest.prepare_completed_at as string | undefined
  }

  const isReady = filesAvailable && checksumValid && cogValid

  return {
    sourceCode: product.variant === 'constrained' ? 'worldpop' : product.variant,
    name: 'WorldPop Guatemala 2020 (auditoría constrained/unconstrained)',
    isReady,
    isOfficial: false,
    referenceYear: product.referenceYear,
    sourceVersion: product.sourceVersion,
    spatialResolutionM: 100,
    semantics: 'modelled_spatial_population',
    rasterHash: existsSync(POPULATION_MANIFEST_PATH)
      ? loadPopulationManifest().downloads.find((d) => d.variant === 'constrained')?.sha256
      : undefined,
    storageReference: 'data/population/worldpop/processed/',
    warnings,
    filesAvailable,
    checksumValid,
    cogValid,
    totalPopulation,
    primaryVariant,
    generatedAt,
  }
}
