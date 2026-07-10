import { runPipeline } from '@/pipeline/orchestrator'

const SYNC_INTERVAL_MS = 60 * 60 * 1000 // cada hora

let intervalId: ReturnType<typeof setInterval> | null = null
let nextSyncAt: Date | null = null

export function getNextSyncAt(): string | null {
  return nextSyncAt?.toISOString() ?? null
}

export function startScheduler(): void {
  if (intervalId) return

  console.log('[TerraMind] Scheduler iniciado — sincronización cada hora')

  // Primera ejecución inmediata al arrancar
  void runPipeline().then((result) => {
    console.log(
      `[TerraMind] Primera sincronización: ${result.observationsIngested} obs, ` +
        `${result.eventsCreated} eventos, ${result.hallazgosCreated} hallazgos`,
    )
  })

  nextSyncAt = new Date(Date.now() + SYNC_INTERVAL_MS)

  intervalId = setInterval(() => {
    nextSyncAt = new Date(Date.now() + SYNC_INTERVAL_MS)
    void runPipeline().then((result) => {
      console.log(
        `[TerraMind] Sync: ${result.observationsIngested} obs, ` +
          `${result.hallazgosCreated} hallazgos nuevos`,
      )
    })
  }, SYNC_INTERVAL_MS)
}

export function stopScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}
