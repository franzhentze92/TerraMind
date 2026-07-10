import { config } from 'dotenv'
import { resolve } from 'node:path'
import { climateService } from '../src/modules/climate/services/climate.service'

config({ path: resolve(process.cwd(), '.env') })

async function main() {
  const status = await climateService.getStatusSummary()
  console.log(JSON.stringify(status, null, 2))
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
})
