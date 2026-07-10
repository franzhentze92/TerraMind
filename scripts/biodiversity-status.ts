import { config } from 'dotenv'
import { resolve } from 'node:path'
import { getBiodiversityService } from '../src/modules/biodiversity/biodiversity.service'

config({ path: resolve(process.cwd(), '.env') })

async function main() {
  const service = getBiodiversityService()
  const health = await service.getSystemHealth()
  console.log(JSON.stringify(health, null, 2))
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
})
