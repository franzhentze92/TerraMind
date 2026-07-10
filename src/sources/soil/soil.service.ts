import { BaseSourceService } from '@/sources/types'

class SoilService extends BaseSourceService {
  readonly sourceType = 'soil' as const
  readonly sourceName = 'SoilGrids / FAO'
}

export const soilService = new SoilService()
