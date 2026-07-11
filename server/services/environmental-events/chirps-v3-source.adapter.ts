/**
 * CHIRPS v3 — observation source adapter (server).
 */
import type {
  ObservationFetchRequest,
  ObservationNormalizationContext,
  ObservationSourceAdapter,
  ObservationSourceHealth,
} from '@/modules/environmental-events/types/observation.types'
import type { EnvironmentalEventType } from '@/modules/environmental-events/types/taxonomy'
import type { ChirpsPentadRef } from '@/modules/precipitation/chirps-v3/chirps-pentad.calendar'
import { dateToPentad, pentadsForWindow } from '@/modules/precipitation/chirps-v3/chirps-pentad.calendar'
import {
  CHIRPS_V3_FINAL_ADAPTER_ID,
  CHIRPS_V3_PRELIMINARY_ADAPTER_ID,
  normalizeGridToObservations,
  type RainfallDeficitObservation,
} from '@/modules/precipitation/chirps-v3/chirps-v3.observations'
import { downloadChirpsPentadTif, loadChirpsManifest, probeChirpsUrl } from '@/modules/precipitation/chirps-v3/chirps-v3.download'
import { readChirpsGridFromTif, isGdalAvailable } from '@/modules/precipitation/chirps-v3/chirps-v3.raster'
import { chirpsPentadTifUrl, type ChirpsVariant } from '@/modules/precipitation/chirps-v3/chirps-v3.urls'
import { CHIRPS_PRELIM_MIN_YEAR } from '@/modules/precipitation/chirps-v3/chirps-v3.config'
import { RAINFALL_DEFICIT_WINDOWS } from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.config'

export interface ChirpsFetchPayload {
  ref: ChirpsPentadRef
  variant: ChirpsVariant
  localPath: string
  url: string
  sha256: string
}

function refsForRequest(request: ObservationFetchRequest): ChirpsPentadRef[] {
  const end = request.until ? new Date(request.until) : new Date()
  const windowDays = RAINFALL_DEFICIT_WINDOWS.days60.days + 30
  return pentadsForWindow(end, windowDays)
}

export class ChirpsV3ObservationSourceAdapter
  implements ObservationSourceAdapter<ChirpsFetchPayload, RainfallDeficitObservation>
{
  readonly id: string
  readonly label: string
  readonly supportedEventTypes: EnvironmentalEventType[] = ['rainfall_deficit']
  readonly variant: ChirpsVariant

  constructor(variant: ChirpsVariant) {
    this.variant = variant
    this.id = variant === 'preliminary' ? CHIRPS_V3_PRELIMINARY_ADAPTER_ID : CHIRPS_V3_FINAL_ADAPTER_ID
    this.label = variant === 'preliminary' ? 'CHIRPS v3 Preliminary (pentad)' : 'CHIRPS v3 Final (pentad)'
  }

  async fetch(request: ObservationFetchRequest): Promise<ChirpsFetchPayload[]> {
    if (request.dryRun) return []
    const refs = refsForRequest(request)
    const out: ChirpsFetchPayload[] = []
    for (const ref of refs) {
      if (this.variant === 'preliminary' && ref.year < CHIRPS_PRELIM_MIN_YEAR) continue
      const url = chirpsPentadTifUrl(ref, this.variant)
      const probe = await probeChirpsUrl(url)
      if (!probe.ok) continue
      const dl = await downloadChirpsPentadTif(ref, this.variant)
      out.push({
        ref,
        variant: this.variant,
        localPath: dl.path,
        url,
        sha256: dl.sha256,
      })
    }
    return out
  }

  async normalize(
    raw: ChirpsFetchPayload[],
    _context: ObservationNormalizationContext,
  ): Promise<RainfallDeficitObservation[]> {
    const gdalOk = await isGdalAvailable()
    if (!gdalOk) return []
    const all: RainfallDeficitObservation[] = []
    for (const item of raw) {
      const grid = await readChirpsGridFromTif(item.localPath, {
        variant: item.variant,
        pentadKey: `${item.ref.year}-${item.ref.month}-${item.ref.pentad}`,
        sourceUrl: item.url,
        checksum: item.sha256,
      })
      all.push(...normalizeGridToObservations(grid, item.ref, item.variant))
    }
    return all
  }

  async getHealth(): Promise<ObservationSourceHealth> {
    const manifest = loadChirpsManifest()
    const variantProducts = manifest.products.filter((p) => p.variant === this.variant)
    const latest = variantProducts.sort((a, b) => b.downloadedAt.localeCompare(a.downloadedAt))[0]
    const gdalOk = await isGdalAvailable()
    const nowRef = dateToPentad(new Date())
    const url = chirpsPentadTifUrl(nowRef, this.variant)
    const probe = await probeChirpsUrl(url)

    let detail: string | undefined
    if (!gdalOk) detail = 'GDAL no disponible; no se pueden leer grillas CHIRPS.'
    else if (!probe.ok) detail = 'Pentada actual aún no publicada en el servidor oficial.'
    else if (this.variant === 'preliminary') detail = 'Producto preliminar disponible.'
    else detail = 'Producto final disponible.'

    return {
      id: this.id,
      label: this.label,
      healthy: gdalOk && variantProducts.length > 0,
      lastSuccessAt: latest?.downloadedAt ?? null,
      providersExpected: 1,
      providersOperational: gdalOk && probe.ok ? 1 : 0,
      detail,
    }
  }
}

export const chirpsV3PreliminaryAdapter = new ChirpsV3ObservationSourceAdapter('preliminary')
export const chirpsV3FinalAdapter = new ChirpsV3ObservationSourceAdapter('final')
