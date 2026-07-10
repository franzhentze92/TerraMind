import { gdalInfoJson } from '@/modules/territory/land-cover/processing/gdal'
import { runCommand } from '@/modules/territory/land-cover/processing/gdal'
import { LAEA_PROJ4 } from '@/modules/territory/land-cover/processing/paths'
import { distributionFromGdalJson } from '@/modules/territory/land-cover/raster/raster-distribution'

export type RasterReadStrategy = 'laea-direct' | 'warp-on-demand'

export async function clipRasterToCutline(input: {
  sourceRasterPath: string
  cutlinePath: string
  cutlineSrs?: string
  outputPath: string
  targetSrs?: string
  resampling?: 'near' | 'bilinear'
}): Promise<void> {
  const args = [
    '-overwrite',
    '-cutline',
    input.cutlinePath,
    '-crop_to_cutline',
    '-dstnodata',
    '0',
    '-multi',
    '-wo',
    'NUM_THREADS=ALL_CPUS',
  ]
  if (input.cutlineSrs) {
    args.push('-cutline_srs', input.cutlineSrs)
  }
  if (input.targetSrs) {
    args.push('-t_srs', input.targetSrs, '-r', input.resampling ?? 'near')
  }
  args.push(input.sourceRasterPath, input.outputPath)
  const res = await runCommand('gdalwarp', args)
  if (res.exitCode !== 0) {
    throw new Error(`gdalwarp clip falló: ${res.stderr || res.stdout}`)
  }
}

export async function analyzeRasterWindow(input: {
  strategy: RasterReadStrategy
  source4326Path: string
  laeaPath: string
  cutlinePath: string
  cutlineSrs: string
  clipOutputPath: string
}) {
  if (input.strategy === 'laea-direct') {
    await clipRasterToCutline({
      sourceRasterPath: input.laeaPath,
      cutlinePath: input.cutlinePath,
      cutlineSrs: input.cutlineSrs,
      outputPath: input.clipOutputPath,
    })
  } else {
    await clipRasterToCutline({
      sourceRasterPath: input.source4326Path,
      cutlinePath: input.cutlinePath,
      cutlineSrs: input.cutlineSrs,
      outputPath: input.clipOutputPath,
      targetSrs: LAEA_PROJ4,
      resampling: 'near',
    })
  }

  const json = await gdalInfoJson(input.clipOutputPath)
  return distributionFromGdalJson(input.clipOutputPath, json)
}

export async function analyzeNationalRasterMasked(input: {
  laeaPath: string
  boundaryPath: string
  clipOutputPath: string
}) {
  await clipRasterToCutline({
    sourceRasterPath: input.laeaPath,
    cutlinePath: input.boundaryPath,
    cutlineSrs: LAEA_PROJ4,
    outputPath: input.clipOutputPath,
  })
  const json = await gdalInfoJson(input.clipOutputPath)
  return distributionFromGdalJson(input.clipOutputPath, json)
}
