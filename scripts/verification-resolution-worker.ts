import { VerificationResolutionWorker } from '@/pipeline/workers/verification-resolution.worker'

const worker = new VerificationResolutionWorker()
let running = true

process.on('SIGINT', () => {
  running = false
})

async function main() {
  console.log('[verification-resolution-worker] started')
  while (running) {
    try {
      const processed = await worker.runOnce()
      if (!processed) await new Promise((r) => setTimeout(r, 2000))
    } catch (err) {
      console.error('[verification-resolution-worker] error', err)
      await new Promise((r) => setTimeout(r, 5000))
    }
  }
}

main()
