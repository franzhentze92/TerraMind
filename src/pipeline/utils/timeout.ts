export class StageTimeoutError extends Error {
  readonly stage: string

  constructor(stage: string, timeoutMs: number) {
    super(`Etapa "${stage}" excedió el tiempo límite (${timeoutMs}ms)`)
    this.name = 'StageTimeoutError'
    this.stage = stage
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  stage: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new StageTimeoutError(stage, timeoutMs)), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
