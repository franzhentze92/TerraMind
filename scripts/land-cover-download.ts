import { config } from 'dotenv'
import { resolve } from 'node:path'
import { downloadLandCoverTiles } from '@/modules/territory/land-cover/processing/download'

config({ path: resolve(process.cwd(), '.env') })

async function main() {
  console.log('⬇️  Descarga tiles ESA WorldCover — Guatemala (7A.2-B)')
  const result = await downloadLandCoverTiles()
  console.log(JSON.stringify({ event: 'land_cover_download_complete', ...result }, null, 2))
}

main().catch((err) => {
  console.error(JSON.stringify({
    event: 'land_cover_download_error',
    message: err instanceof Error ? err.message : String(err),
  }))
  process.exit(1)
})
