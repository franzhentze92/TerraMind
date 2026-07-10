import { config } from 'dotenv'
import { resolve } from 'node:path'
import { climateService } from '../src/modules/climate/services/climate.service'

config({ path: resolve(process.cwd(), '.env') })

function parseArgs(argv: string[]) {
  let locationId: string | undefined
  for (const arg of argv) {
    if (arg.startsWith('--location=')) {
      locationId = arg.slice('--location='.length)
    }
  }
  return { locationId }
}

async function main() {
  const { locationId } = parseArgs(process.argv.slice(2))
  const started = Date.now()

  if (locationId) {
    console.log(`Refrescando ubicación ${locationId}…`)
    const snapshot = await climateService.refreshLocation(locationId)
    console.log(
      JSON.stringify(
        {
          location: snapshot.location.display_name,
          current: snapshot.current,
          forecast_hours: snapshot.hourly.length,
          data_status: snapshot.data_status,
          duration_ms: Date.now() - started,
        },
        null,
        2,
      ),
    )
    return
  }

  console.log('Refrescando todas las ubicaciones activas…')
  const result = await climateService.refreshAllActiveLocations()
  console.log(JSON.stringify({ ...result, duration_ms: Date.now() - started }, null, 2))
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
})
