#!/usr/bin/env tsx
import { ResponseOrchestrationWorker } from '@/pipeline/workers/response-orchestration.worker'

const worker = new ResponseOrchestrationWorker()
let running = true

process.on('SIGINT', () => {
  running = false
})

async function main() {
  console.log('[response-orchestration-worker] started')
  while (running) {
    try {
      const processed = await worker.runOnce()
      if (!processed) await new Promise((r) => setTimeout(r, 2000))
    } catch (err) {
      console.error('[response-orchestration-worker] error', err)
      await new Promise((r) => setTimeout(r, 5000))
    }
  }
}

main()
