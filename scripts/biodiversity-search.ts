import { config } from 'dotenv'
import { resolve } from 'node:path'
import { getBiodiversityService } from '../src/modules/biodiversity/biodiversity.service'

config({ path: resolve(process.cwd(), '.env') })

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : undefined
}

async function main() {
  const lat = Number(readArg('lat'))
  const lng = Number(readArg('lng'))
  const radius = Number(readArg('radius') ?? readArg('radius_m') ?? 5000)
  const limit = Number(readArg('limit') ?? 30)
  const provider = readArg('provider') as 'gbif' | 'inaturalist' | undefined
  const from = readArg('from')
  const to = readArg('to')
  const taxon = readArg('taxon')

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    console.error('Uso: npm run biodiversity:search -- --lat=... --lng=... [--radius=5000] [--limit=30]')
    process.exitCode = 1
    return
  }

  const service = getBiodiversityService()
  const started = Date.now()
  const result = await service.searchOccurrencesPublic({
    latitude: lat,
    longitude: lng,
    radiusM: radius,
    observedFrom: from,
    observedTo: to,
    scientificName: taxon,
    providers: provider ? [provider] : undefined,
    limit,
    qualityFilters: {
      requireCoordinates: true,
      excludeGeospatialIssues: true,
      researchGradeOnly: false,
    },
  })

  console.log(
    JSON.stringify(
      {
        ...result,
        latency_ms: Date.now() - started,
        unique_species: new Set(result.items.map((i) => i.scientific_name)).size,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
})
