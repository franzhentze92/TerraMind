/**
 * Diseño del lector raster poblacional — implementación en 7D.1A/7D.1B.
 *
 * Estrategia:
 * - COG fuente versionado (WorldPop WGS84) fuera de Git
 * - COG analítico LAEA-GT derivado para buffers métricos
 * - Lectura por ventana (bounding box de geometría + margen)
 * - Sin PostGIS Raster en fase inicial
 */

import type { PopulationSourceStatus } from '../population.types'

export interface PopulationRasterMetadata {
  crs: string
  width: number
  height: number
  resolutionM: number
  bounds: [number, number, number, number]
  nodata: number | null
  dtype: string
  unit: 'persons_per_pixel'
  checksumSha256: string
  referenceYear: number
  sourceVersion: string
}

export interface PopulationRasterValidationResult {
  valid: boolean
  nationalSum: number
  negativePixelCount: number
  nonFinitePixelCount: number
  coverageOutsideCountryPct: number
  departmentSamples: Array<{
    adminCode: string
    rasterSum: number
    officialIne?: number
    differencePct?: number
  }>
  errors: string[]
  warnings: string[]
}

export interface PopulationRasterReader {
  getSourceStatus(): Promise<PopulationSourceStatus>
  ensureReady(): Promise<void>
  getMetadata(): Promise<PopulationRasterMetadata>
  validateAgainstIne(): Promise<PopulationRasterValidationResult>
  /** Suma población en ventana [minX, minY, maxX, maxY] en CRS del raster analítico. */
  sumWindow(bounds: [number, number, number, number]): Promise<{
    populationSum: number
    validPixelCount: number
    nodataPixelCount: number
    dataCoveragePct: number
  }>
}

export class PopulationRasterReaderNotImplementedError extends Error {
  constructor() {
    super('PopulationRasterReader: implementación pendiente (7D.1A).')
    this.name = 'PopulationRasterReaderNotImplementedError'
  }
}

export function createPopulationRasterReader(): PopulationRasterReader {
  return {
    async getSourceStatus() {
      throw new PopulationRasterReaderNotImplementedError()
    },
    async ensureReady() {
      throw new PopulationRasterReaderNotImplementedError()
    },
    async getMetadata() {
      throw new PopulationRasterReaderNotImplementedError()
    },
    async validateAgainstIne() {
      throw new PopulationRasterReaderNotImplementedError()
    },
    async sumWindow() {
      throw new PopulationRasterReaderNotImplementedError()
    },
  }
}
