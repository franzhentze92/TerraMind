import { EvidenceProcessingWorker } from '@/pipeline/workers/evidence-processing.worker'

const worker = new EvidenceProcessingWorker()
let running = true

process.on('SIGINT', () => {
  running = false
})

async function main() {
  console.log('[evidence-worker] started')
  while (running) {
    try {
      const processed = await worker.runOnce()
      if (!processed) await new Promise((r) => setTimeout(r, 2000))
    } catch (err) {
      console.error('[evidence-worker] error', err)
      await new Promise((r) => setTimeout(r, 5000))
    }
  }
}

main()
