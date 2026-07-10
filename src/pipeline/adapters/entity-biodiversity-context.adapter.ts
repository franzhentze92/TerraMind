import type { BiodiversityEventAnalysis } from '@/modules/biodiversity/services/biodiversity-event-query.service'

export interface EntityBiodiversityContextInput {
  entityType: string
  entityId: string
  detections: Array<{ latitude: number; longitude: number }>
  centroidLat?: number | null
  centroidLng?: number | null
  eventTime: string
}

export interface EntityBiodiversityContextResult {
  entityType: string
  entityId: string
  analysis: BiodiversityEventAnalysis
}

export interface EntityBiodiversityContextAdapter {
  enrichEntity(input: EntityBiodiversityContextInput): Promise<EntityBiodiversityContextResult>
}
