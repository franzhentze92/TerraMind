import { config } from 'dotenv'
import { resolve } from 'node:path'
import { LandCoverEnrichmentWorker } from '@/pipeline/workers/land-cover-enrichment.worker'

config({ path: resolve(process.cwd(), '.env') })

function parseArgs(argv: string[]): { once: boolean; limit: number } {
  let once = false
  let limit = 0
  for (const arg of argv) {
    if (arg === '--once') once = true
    const limitMatch = arg.match(/^--limit=(\d+)$/)
    if (limitMatch) limit = Number(limitMatch[1])
  }
  return { once, limit }
}

async function main() {
  const { once, limit } = parseArgs(process.argv.slice(2))
  const worker = new LandCoverEnrichmentWorker()

  const metrics = once
    ? await worker.processOnce(limit > 0 ? limit : 1)
    : await worker.runUntilEmpty()

  console.log(JSON.stringify({ event: 'land_cover_worker_run', ...metrics }, null, 2))
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
