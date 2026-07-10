import { config } from 'dotenv'
import { resolve } from 'node:path'
import { getFirePipelineHealth } from '../server/services/fire-pipeline-health.service.js'

config({ path: resolve(process.cwd(), '.env') })

async function main() {
  const health = await getFirePipelineHealth()
  console.log(JSON.stringify(health, null, 2))
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
})
