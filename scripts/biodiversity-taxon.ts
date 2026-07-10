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
  const name = readArg('name')
  const taxonId = readArg('taxon_id')
  const provider = readArg('provider') as 'gbif' | 'inaturalist' | undefined

  if (!name && !taxonId) {
    console.error('Uso: npm run biodiversity:taxon -- --name="Panthera onca" [--provider=gbif]')
    process.exitCode = 1
    return
  }

  const service = getBiodiversityService()
  const taxon = await service.resolveTaxon({
    scientificName: name,
    taxonId,
    provider: provider ?? 'gbif',
  })

  console.log(JSON.stringify({ taxon, generated_at: new Date().toISOString() }, null, 2))
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
})
