import { config } from 'dotenv'
import { resolve } from 'node:path'
import { climateService } from '../src/modules/climate/services/climate.service'

config({ path: resolve(process.cwd(), '.env') })

async function main() {
  const started = Date.now()
  const locations = await climateService.registerNationalLocations()

  console.log(`✅ Ubicaciones registradas: ${locations.length}`)
  const countries = locations.filter((l) => l.location_type === 'country')
  const departments = locations.filter((l) => l.location_type === 'department')
  console.log(`   · Puntos de referencia nacional: ${countries.length}`)
  console.log(`   · Puntos de referencia departamentales: ${departments.length}`)

  if (locations.length !== 23) {
    console.warn(`⚠️  Se esperaban 23 ubicaciones (1 país + 22 departamentos), hay ${locations.length}`)
  }

  for (const loc of locations) {
    console.log(`  - ${loc.location_type.padEnd(12)} ${loc.display_name} (${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)})`)
  }

  console.log(`\nDuración registro: ${Date.now() - started} ms`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
})
