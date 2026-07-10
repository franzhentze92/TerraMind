import { OfflinePackageWorker } from '@/pipeline/workers/offline-package.worker'

const worker = new OfflinePackageWorker()
let running = true

process.on('SIGINT', () => {
  running = false
})

async function main() {
  console.log('[offline-package-worker] started')
  while (running) {
    try {
      const processed = await worker.runOnce()
      if (!processed) await new Promise((r) => setTimeout(r, 2000))
    } catch (err) {
      console.error('[offline-package-worker] error', err)
      await new Promise((r) => setTimeout(r, 5000))
    }
  }
}

main()
