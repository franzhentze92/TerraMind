import { config } from 'dotenv'
import { resolve } from 'node:path'
import { validateLandCoverArtifacts } from '@/modules/territory/land-cover/processing/validate'

config({ path: resolve(process.cwd(), '.env') })

async function main() {
  console.log('✅ Validación cobertura del suelo — Guatemala (7A.2-B)')
  const result = await validateLandCoverArtifacts()
  console.log(JSON.stringify({ event: 'land_cover_validate_complete', ...result }, null, 2))
  if (!result.ok) process.exit(1)
}

main().catch((err) => {
  console.error(JSON.stringify({
    event: 'land_cover_validate_error',
    message: err instanceof Error ? err.message : String(err),
  }))
  process.exit(1)
})
