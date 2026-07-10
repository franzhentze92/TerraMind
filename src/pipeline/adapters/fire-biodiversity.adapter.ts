import { analyzeBiodiversityForFireEvent } from '@/modules/biodiversity/services/biodiversity-event-query.service'
import type {
  EntityBiodiversityContextAdapter,
  EntityBiodiversityContextInput,
  EntityBiodiversityContextResult,
} from './entity-biodiversity-context.adapter'

export function createFireBiodiversityAdapter(): EntityBiodiversityContextAdapter {
  return {
    async enrichEntity(input: EntityBiodiversityContextInput): Promise<EntityBiodiversityContextResult> {
      const analysis = await analyzeBiodiversityForFireEvent({
        detections: input.detections,
        centroidLat: input.centroidLat,
        centroidLng: input.centroidLng,
        eventTime: input.eventTime,
      })
      return {
        entityType: input.entityType,
        entityId: input.entityId,
        analysis,
      }
    },
  }
}
