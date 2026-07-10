import { EvidenceValidationWorker } from '@/pipeline/workers/evidence-validation.worker'

const worker = new EvidenceValidationWorker()
let running = true

process.on('SIGINT', () => {
  running = false
})

async function main() {
  console.log('[evidence-validation-worker] started')
  while (running) {
    try {
      const processed = await worker.runOnce()
      if (!processed) await new Promise((r) => setTimeout(r, 2000))
    } catch (err) {
      console.error('[evidence-validation-worker] error', err)
      await new Promise((r) => setTimeout(r, 5000))
    }
  }
}

main()
