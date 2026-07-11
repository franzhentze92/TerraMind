#!/usr/bin/env tsx
/**
 * Dedicated response orchestration worker process.
 * For co-located deployment the TerraMind server scheduler is preferred (server/index.ts).
 * Use this script when running workers as a separate service/replica.
 */
import {
  startResponseOrchestrationScheduler,
  stopResponseOrchestrationScheduler,
  awaitResponseOrchestrationSchedulerDrain,
} from '@/pipeline/scheduler/response-orchestration.scheduler'

startResponseOrchestrationScheduler()
console.log('[response-orchestration-worker] dedicated process started')

async function shutdown(signal: string): Promise<void> {
  console.log(`[response-orchestration-worker] ${signal}`)
  stopResponseOrchestrationScheduler()
  await awaitResponseOrchestrationSchedulerDrain()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
