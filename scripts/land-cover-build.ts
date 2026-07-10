import { config } from 'dotenv'
import { resolve } from 'node:path'
import { buildLandCoverCogs } from '@/modules/territory/land-cover/processing/build'

config({ path: resolve(process.cwd(), '.env') })

async function main() {
  console.log('🔧 Construcción COG cobertura del suelo — Guatemala (7A.2-B)')
  const result = await buildLandCoverCogs()
  console.log(JSON.stringify({ event: 'land_cover_build_complete', ...result }, null, 2))
}

main().catch((err) => {
  console.error(JSON.stringify({
    event: 'land_cover_build_error',
    message: err instanceof Error ? err.message : String(err),
  }))
  process.exit(1)
})
