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
import type { PopulationSourceStatus, PopulationWarning, WorldPopServiceVariant } from '@/modules/territory/population/population.types'
import { getWorldPopProduct } from '@/modules/territory/population/providers/worldpop/worldpop-products'

export interface LocalPopulationSourceStatus extends Omit<PopulationSourceStatus, 'primaryVariant'> {
  filesAvailable: boolean
  checksumValid: boolean
  cogValid: boolean
  variants: Array<{
    variant: 'constrained' | 'unconstrained'
    rawAvailable: boolean
    wgs84CogAvailable: boolean
    laeaCogAvailable: boolean
    laeaApproved: boolean
    checksumValid: boolean
    totalPopulation?: number
    cellSemantics: string
    crs: string
    resamplingWgs84: string
    resamplingLaea?: string
    conservationDeltaPct?: number
    laeaVerdict?: string
  }>
  totalPopulation?: number
  primaryVariant?: WorldPopServiceVariant | 'dual_use'
  validationRasterHash?: string
  generatedAt?: string
}

export async function getLocalPopulationSourceStatus(): Promise<LocalPopulationSourceStatus> {
  const warnings: PopulationWarning[] = []
  const product = getWorldPopProduct('constrained')

  let manifestChecksums: Record<string, string | undefined> = {}
  let primaryVariant: 'constrained' | 'unconstrained' | 'dual_use' | undefined
  let generatedAt: string | undefined

  if (existsSync(POPULATION_MANIFEST_PATH)) {
    try {
      const manifest = loadPopulationManifest()
      for (const entry of manifest.downloads) {
        manifestChecksums[entry.variant] = entry.sha256
      }
      primaryVariant = manifest.recommended_primary_variant
      generatedAt = manifest.prepare_completed_at as string | undefined
    } catch {
      warnings.push(populationWarning('source_unavailable', 'Manifest inválido o ausente.'))
    }
  } else {
    warnings.push(populationWarning('source_unavailable', 'Manifest de población no encontrado.'))
  }

  const variants: LocalPopulationSourceStatus['variants'] = []
  let filesAvailable = true
  let checksumValid = true
  let cogValid = true
  let totalPopulation: number | undefined

  for (const variant of ['constrained', 'unconstrained'] as const) {
    const rawPath = rawRasterPath(variant)
    const wgs84Cog = processedWgs84Cog(variant)
    const laeaCog = processedLaeaCog(variant)
    const rawAvailable = existsSync(rawPath)
    const wgs84CogAvailable = existsSync(wgs84Cog)
    const laeaCogAvailable = existsSync(laeaCog)

    let variantChecksumValid = false
    if (rawAvailable && manifestChecksums[variant]) {
      variantChecksumValid = (await sha256File(rawPath)) === manifestChecksums[variant]
    }

    let variantPopulation: number | undefined
    if (wgs84CogAvailable) {
      try {
        const inspection = await inspectPopulationRaster(wgs84Cog)
        variantPopulation = inspection.populationSum
        if (variant === 'constrained') totalPopulation = inspection.populationSum
      } catch {
        warnings.push(
          populationWarning('raster_processing_failed', `No se pudo inspeccionar COG ${variant}.`),
        )
      }
    }

    if (!rawAvailable || !wgs84CogAvailable) filesAvailable = false
    if (!variantChecksumValid) {
      checksumValid = false
      if (rawAvailable) {
        warnings.push(
          populationWarning('checksum_invalid', `Checksum inválido para raster ${variant}.`),
        )
      }
    }
    if (!wgs84CogAvailable || !variantPopulation) cogValid = false

    const manifest = existsSync(POPULATION_MANIFEST_PATH)
      ? loadPopulationManifest()
      : undefined
    const conservation = manifest?.conservation?.find((c) => c.variant === variant)
    const laeaApproved = conservation?.laea_approved === true

    variants.push({
      variant,
      rawAvailable,
      wgs84CogAvailable,
      laeaCogAvailable: laeaCogAvailable && laeaApproved,
      laeaApproved,
      checksumValid: variantChecksumValid,
      totalPopulation: variantPopulation,
      cellSemantics: 'persons_per_pixel',
      crs: wgs84CogAvailable ? 'EPSG:4326' : 'unknown',
      resamplingWgs84: 'none (ADM0 crop)',
      resamplingLaea: laeaApproved ? 'sum' : conservation?.laea_verdict === 'reject' ? 'rejected' : 'skipped',
      conservationDeltaPct: conservation?.diff_laea_pct,
      laeaVerdict: conservation?.laea_verdict,
    })
  }

  const constrainedConservation = existsSync(POPULATION_MANIFEST_PATH)
    ? loadPopulationManifest().conservation?.find((c) => c.variant === 'constrained')
    : undefined
  if (constrainedConservation?.wgs84_approved === false) {
    warnings.push(populationWarning('raster_processing_failed', 'COG WGS84 constrained no aprobado por conservación.'))
    cogValid = false
  }

  if (!filesAvailable) {
    warnings.push(
      populationWarning('source_unavailable', 'Archivos locales WorldPop incompletos.'),
    )
  }

  const isReady = filesAvailable && checksumValid && cogValid

  return {
    sourceCode: 'worldpop',
    name: 'WorldPop Guatemala 2020 (constrained + unconstrained)',
    isReady,
    operationalHealth: isReady ? 'healthy' : 'degraded',
    isOfficial: false,
    referenceYear: product.referenceYear,
    sourceVersion: product.sourceVersion,
    spatialResolutionM: 100,
    semantics: 'modelled_spatial_population',
    rasterHash: manifestChecksums.constrained,
    storageReference: 'data/population/worldpop/processed/',
    primaryVariant: primaryVariant === 'dual_use' ? 'constrained' : (primaryVariant ?? 'constrained'),
    validationVariant: 'unconstrained',
    warnings,
    filesAvailable,
    checksumValid,
    cogValid,
    variants,
    totalPopulation,
    validationRasterHash: manifestChecksums.unconstrained,
    generatedAt,
  }
}
