import { config } from 'dotenv'
import { resolve } from 'node:path'
import { getBiodiversityService } from '../src/modules/biodiversity/biodiversity.service'
import type { BiodiversityProviderId } from '../src/modules/biodiversity/biodiversity.types'

config({ path: resolve(process.cwd(), '.env') })

const ZONES = [
  { id: 'A', name: 'Reserva Biosfera Maya, Petén', lat: 17.75, lng: -90.25 },
  { id: 'B', name: 'Volcán Acatenango', lat: 14.501, lng: -90.876 },
  { id: 'C', name: 'Manchón Guamuchal / Retalhuleu', lat: 14.05, lng: -91.75 },
] as const

async function probeZone(
  zone: (typeof ZONES)[number],
  provider: BiodiversityProviderId,
) {
  const service = getBiodiversityService()
  const started = Date.now()
  const result = await service.searchOccurrences({
    latitude: zone.lat,
    longitude: zone.lng,
    radiusM: 10_000,
    limit: 20,
    providers: [provider],
    qualityFilters: {
      requireCoordinates: true,
      excludeGeospatialIssues: true,
    },
  })
  const items = result.byProvider[provider]?.occurrences ?? []
  const species = new Set(items.map((i) => i.scientificName))
  const kingdoms = new Set(items.map((i) => i.kingdom).filter(Boolean))
  const dates = items.map((i) => i.observedAt).filter(Boolean).sort()
  const licenses = [...new Set(items.map((i) => i.license ?? 'unknown'))]
  return {
    zone: zone.id,
    zone_name: zone.name,
    provider,
    records_received: items.length,
    unique_species: species.size,
    taxonomic_groups: [...kingdoms],
    temporal_range:
      dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : null,
    quality_grades: [...new Set(items.map((i) => i.qualityGrade).filter(Boolean))],
    obscured_count: items.filter((i) => i.coordinatesObscured || i.privacyLevel !== 'public_exact')
      .length,
    licenses,
    possible_duplicates: items.filter((i) => i.possibleDuplicate).length,
    last_observation: dates[dates.length - 1] ?? null,
    latency_ms: Date.now() - started,
    total_estimate: result.byProvider[provider]?.totalEstimate,
  }
}

async function main() {
  const reports = []
  for (const zone of ZONES) {
    for (const provider of ['gbif', 'inaturalist'] as const) {
      try {
        reports.push(await probeZone(zone, provider))
      } catch (err) {
        reports.push({
          zone: zone.id,
          provider,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }
  console.log(JSON.stringify({ generated_at: new Date().toISOString(), reports }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
