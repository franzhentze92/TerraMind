import { BaseSourceService } from '@/sources/types'

class ClimateService extends BaseSourceService {
  readonly sourceType = 'climate' as const
  readonly sourceName = 'Climate Data Store'
}

export const climateService = new ClimateService()
