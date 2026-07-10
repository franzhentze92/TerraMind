import { gdalInfoJsonNoHist, runCommand } from '@/modules/territory/population/processing/gdal'
import { calculatePopulationRasterSum } from '@/modules/territory/population/processing/raster-sum'
import {
  computeDataCoveragePct,
  computeDensityPerKm2,
} from '@/modules/territory/population/raster/population-zonal-statistics'

export interface PopulationCutlineSumResult {
  populationSum: number
  validPixelCount: number
  nodataPixelCount: number
  negativePixelCount: number
  nonFinitePixelCount: number
  dataCoveragePct: number
  analyzedAreaHa: number
  densityPerKm2: number
  pixelAreaM2: number
}

function pixelAreaM2FromJson(json: Record<string, unknown>): number {
  const geoTransform = json.geoTransform as number[] | undefined
  if (geoTransform && geoTransform.length >= 6) {
    return Math.abs(geoTransform[1] * geoTransform[5])
  }
  return 100 * 100
}

export async function clipRasterToCutline(input: {
  sourceRasterPath: string
  cutlinePath: string
  cutlineSrs?: string
  outputPath: string
  targetSrs?: string
  dstNodata?: number
}): Promise<void> {
  const args = [
    '-overwrite',
    '-cutline',
    input.cutlinePath,
    '-crop_to_cutline',
    '-dstnodata',
    String(input.dstNodata ?? -9999),
    '-multi',
    '-wo',
    'NUM_THREADS=ALL_CPUS',
  ]
  if (input.cutlineSrs) args.push('-cutline_srs', input.cutlineSrs)
  if (input.targetSrs) args.push('-t_srs', input.targetSrs, '-r', 'near')
  args.push(input.sourceRasterPath, input.outputPath)
  const res = await runCommand('gdalwarp', args)
  if (res.exitCode !== 0) {
    throw new Error(`gdalwarp clip falló: ${res.stderr || res.stdout}`)
  }
}

export async function sumPopulationAtCutline(input: {
  sourceRasterPath: string
  cutlinePath: string
  cutlineSrs?: string
  clipOutputPath: string
  targetSrs?: string
}): Promise<PopulationCutlineSumResult> {
  await clipRasterToCutline({
    sourceRasterPath: input.sourceRasterPath,
    cutlinePath: input.cutlinePath,
    cutlineSrs: input.cutlineSrs,
    outputPath: input.clipOutputPath,
    targetSrs: input.targetSrs,
  })

  const [sumResult, metaJson] = await Promise.all([
    calculatePopulationRasterSum(input.clipOutputPath),
    gdalInfoJsonNoHist(input.sourceRasterPath),
  ])

  const pixelAreaM2 = pixelAreaM2FromJson(metaJson)
  const pixelsInClip = sumResult.validCount + sumResult.nodataCount
  const analyzedAreaHa = (pixelsInClip * pixelAreaM2) / 10_000
  const populationSum = sumResult.totalSum
  const dataCoveragePct = computeDataCoveragePct(
    sumResult.validCount,
    sumResult.nodataCount,
  )

  return {
    populationSum,
    validPixelCount: sumResult.validCount,
    nodataPixelCount: sumResult.nodataCount,
    negativePixelCount: sumResult.negativeCount,
    nonFinitePixelCount: sumResult.nonFiniteCount,
    dataCoveragePct,
    analyzedAreaHa: Math.round(analyzedAreaHa * 100) / 100,
    densityPerKm2: computeDensityPerKm2(populationSum, analyzedAreaHa),
    pixelAreaM2,
  }
}
