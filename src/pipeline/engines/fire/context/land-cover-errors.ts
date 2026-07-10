import type { LandCoverJobErrorCode } from '@/pipeline/stores/land-cover-jobs.types'
import { LandCoverSourceUnavailableError } from '@/pipeline/engines/fire/context/land-cover.engine'
import { StageTimeoutError } from '@/pipeline/utils/timeout'

export interface ClassifiedLandCoverError {
  code: LandCoverJobErrorCode
  message: string
  retryable: boolean
}

export function classifyLandCoverJobError(err: unknown): ClassifiedLandCoverError {
  if (err instanceof StageTimeoutError) {
    return {
      code: 'job_timeout',
      message: 'Tiempo de procesamiento excedido',
      retryable: true,
    }
  }

  if (err instanceof LandCoverSourceUnavailableError) {
    return {
      code: 'source_unavailable',
      message: err.message,
      retryable: false,
    }
  }

  const message = err instanceof Error ? err.message : 'Error de procesamiento'
  const lower = message.toLowerCase()

  if (lower.includes('evento no encontrado') || lower.includes('not found')) {
    return { code: 'event_not_found', message, retryable: false }
  }
  if (lower.includes('geometr') || lower.includes('invalid_geometry')) {
    return { code: 'invalid_geometry', message, retryable: false }
  }
  if (lower.includes('context_version') || lower.includes('versión de contexto')) {
    return { code: 'invalid_context_version', message, retryable: false }
  }
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('gdal')) {
    return { code: 'gdal_timeout', message, retryable: true }
  }
  if (
    lower.includes('econnreset') ||
    lower.includes('etimedout') ||
    lower.includes('temporar') ||
    lower.includes('locked') ||
    lower.includes('eacces')
  ) {
    return { code: 'io_transient', message, retryable: true }
  }
  if (lower.includes('connection') || lower.includes('fetch failed') || lower.includes('db')) {
    return { code: 'db_transient', message, retryable: true }
  }

  return { code: 'processing_failed', message, retryable: false }
}
