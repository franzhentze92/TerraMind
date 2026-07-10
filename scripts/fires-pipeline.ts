import { config } from 'dotenv'
import { resolve } from 'node:path'
import { runFirePipeline } from '@/pipeline/jobs/fire-pipeline.job'

config({ path: resolve(process.cwd(), '.env') })

async function main() {
  const result = await runFirePipeline({ triggerType: 'manual' })

  console.log('\n=== TerraMind Fire Pipeline ===')
  console.log(`pipeline_run_id: ${result.pipelineRunId}`)
  console.log(`status:          ${result.status}`)
  console.log(`duration_ms:     ${result.durationMs}`)
  console.log(`ingestion_run:   ${result.ingestionRunId ?? '—'}`)

  for (const [stage, record] of Object.entries(result.stages)) {
    console.log(`\n[${stage}] ${record.status} (${record.duration_ms}ms)`)
    if (record.metrics) {
      console.log(JSON.stringify(record.metrics, null, 2))
    }
    if (record.error) console.log(`error: ${record.error}`)
  }

  if (result.errorMessage && result.status !== 'skipped') {
    console.log(`\nerror_message: ${result.errorMessage}`)
    process.exitCode = 1
  } else if (result.status === 'skipped') {
    console.log(`\nskipped: ${result.skippedReason ?? result.errorMessage}`)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
})
