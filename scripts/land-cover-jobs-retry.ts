import { config } from 'dotenv'
import { resolve } from 'node:path'
import { enqueueLandCoverJobs } from '@/pipeline/engines/fire/context/land-cover-jobs.engine'
import { retryFailedLandCoverJob } from '@/pipeline/stores/land-cover-jobs.store'

config({ path: resolve(process.cwd(), '.env') })

function parseArgs(argv: string[]): { eventId?: string; force: boolean; confirm: boolean } {
  let eventId: string | undefined
  let force = false
  let confirm = false
  for (const arg of argv) {
    const eventMatch = arg.match(/^--event=(.+)$/)
    if (eventMatch) eventId = eventMatch[1]
    if (arg === '--force') force = true
    if (arg === '--confirm') confirm = true
  }
  return { eventId, force, confirm }
}

async function main() {
  const { eventId, force, confirm } = parseArgs(process.argv.slice(2))

  if (!eventId && !confirm) {
    console.error('Retry masivo requiere --confirm. Use --event=<uuid> para un evento.')
    process.exit(1)
  }

  if (eventId) {
    if (force) {
      const enqueued = await enqueueLandCoverJobs({ eventId, force: true, limit: 1 })
      console.log(JSON.stringify({ event: 'land_cover_job_retry', mode: 'enqueue_force', ...enqueued }, null, 2))
      return
    }

    const retried = await retryFailedLandCoverJob(eventId)
    console.log(
      JSON.stringify(
        { event: 'land_cover_job_retry', event_id: eventId, retried_failed_job: retried },
        null,
        2,
      ),
    )
    return
  }

  const enqueued = await enqueueLandCoverJobs({ limit: 10000, force })
  console.log(JSON.stringify({ event: 'land_cover_job_retry', mode: 'bulk_enqueue', ...enqueued }, null, 2))
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
