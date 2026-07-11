/**
 * CHIRPS v3 — normalized pentad observations per grid cell.
 */
import {
  CHIRPS_V3_PROCESSING_VERSION,
  CHIRPS_V3_SOURCE_VERSION,
} from '@/modules/precipitation/chirps-v3/chirps-v3.config'
import type { ChirpsPentadRef } from '@/modules/precipitation/chirps-v3/chirps-pentad.calendar'
import type { ChirpsGridSnapshot } from '@/modules/precipitation/chirps-v3/chirps-grid.types'
import { chirpsObservationId, type ChirpsVariant } from '@/modules/precipitation/chirps-v3/chirps-v3.urls'
import type { ChirpsPentadObservationAttributes } from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.types'
import type { EnvironmentalObservation } from '@/modules/environmental-events/types/observation.types'
import { cellToPolygon } from '@/modules/precipitation/chirps-v3/chirps-grid.types'

export const CHIRPS_V3_PRELIMINARY_ADAPTER_ID = 'chirps_v3_preliminary_pentad'
export const CHIRPS_V3_FINAL_ADAPTER_ID = 'chirps_v3_final_pentad'

export type RainfallDeficitObservation = EnvironmentalObservation<
  'rainfall_deficit',
  ChirpsPentadObservationAttributes
>

export function adapterIdForVariant(variant: ChirpsVariant): string {
  return variant === 'preliminary' ? CHIRPS_V3_PRELIMINARY_ADAPTER_ID : CHIRPS_V3_FINAL_ADAPTER_ID
}

export function normalizeGridToObservations(
  grid: ChirpsGridSnapshot,
  ref: ChirpsPentadRef,
  variant: ChirpsVariant,
): RainfallDeficitObservation[] {
  const adapterId = adapterIdForVariant(variant)
  const now = new Date().toISOString()
  const qualityFlags: string[] = []
  if (variant === 'preliminary') qualityFlags.push('producto_preliminar')
  if (grid.cells.some((c) => c.isNoData)) qualityFlags.push('celdas_sin_dato')

  return grid.cells
    .filter((c) => !c.isNoData)
    .map((cell) => ({
      id: chirpsObservationId(ref, cell.row, cell.col, variant, CHIRPS_V3_PROCESSING_VERSION),
      eventType: 'rainfall_deficit' as const,
      sourceAdapterId: adapterId,
      sourceObservationId: `${ref.year}-${ref.month}-${ref.pentad}_${cell.row}_${cell.col}`,
      observedAt: ref.periodEnd,
      receivedAt: now,
      geometry: cellToPolygon(cell, grid.resolutionDeg),
      attributes: {
        precipitationMm: cell.precipitationMm,
        pentadYear: ref.year,
        pentadMonth: ref.month,
        pentadIndex: ref.pentad,
        periodStart: ref.periodStart,
        periodEnd: ref.periodEnd,
        productStatus: variant,
        sourceVersion: CHIRPS_V3_SOURCE_VERSION,
        variant,
        processingVersion: CHIRPS_V3_PROCESSING_VERSION,
        checksum: grid.checksum,
        originUrl: grid.sourceUrl,
        qualityFlags,
      },
    }))
}
