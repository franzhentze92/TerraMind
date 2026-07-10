import type { LandCoverEnrichmentStateDto } from '@/modules/fires/types/fire.dto'
import type { LandCoverContextDto } from '@/modules/fires/types/fire.dto'
import type { LandCoverEnrichmentJobRow } from '@/pipeline/stores/land-cover-jobs.types'

export function buildLandCoverEnrichmentState(
  context: LandCoverContextDto | null,
  activeJob: LandCoverEnrichmentJobRow | null,
): LandCoverEnrichmentStateDto | null {
  if (context) {
    return {
      status: 'complete',
      message: null,
    }
  }

  if (!activeJob) {
    return {
      status: 'unavailable',
      message: 'Contexto de cobertura del suelo aún no calculado.',
    }
  }

  if (activeJob.status === 'pending') {
    return {
      status: 'queued',
      message: 'Contexto de cobertura del suelo en procesamiento.',
    }
  }

  if (activeJob.status === 'processing') {
    return {
      status: 'processing',
      message: 'Contexto de cobertura del suelo en procesamiento.',
    }
  }

  return {
    status: 'unavailable',
    message: 'Contexto de cobertura del suelo aún no calculado.',
  }
}
