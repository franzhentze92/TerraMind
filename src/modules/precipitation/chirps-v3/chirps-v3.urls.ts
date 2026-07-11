/**
 * CHIRPS v3 — official GeoTIFF URL builders (Preliminary vs Final separated).
 */
import { CHIRPS_V3_BASE, CHIRPS_V3_REGION } from '@/modules/precipitation/chirps-v3/chirps-v3.config'
import type { ChirpsPentadRef } from '@/modules/precipitation/chirps-v3/chirps-pentad.calendar'
import { pentadFileName } from '@/modules/precipitation/chirps-v3/chirps-pentad.calendar'

export type ChirpsVariant = 'preliminary' | 'final'

export function chirpsPentadTifUrl(ref: ChirpsPentadRef, variant: ChirpsVariant): string {
  const file = pentadFileName(ref)
  if (variant === 'preliminary') {
    return `${CHIRPS_V3_BASE}/prelim/pentads/${CHIRPS_V3_REGION}/tifs/${file}`
  }
  return `${CHIRPS_V3_BASE}/pentads/${CHIRPS_V3_REGION}/tifs/${file}`
}

export function chirpsProductIdentity(ref: ChirpsPentadRef, variant: ChirpsVariant): string {
  return `chirps_v3_${variant}_${ref.year}_${ref.month}_${ref.pentad}`
}

export function chirpsObservationId(
  ref: ChirpsPentadRef,
  cellRow: number,
  cellCol: number,
  variant: ChirpsVariant,
  processingVersion: string,
): string {
  return `${chirpsProductIdentity(ref, variant)}_r${cellRow}_c${cellCol}_pv_${processingVersion}`
}
