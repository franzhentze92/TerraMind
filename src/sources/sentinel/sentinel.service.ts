import { BaseSourceService } from '@/sources/types'

class SentinelService extends BaseSourceService {
  readonly sourceType = 'sentinel' as const
  readonly sourceName = 'Copernicus Sentinel'
}

export const sentinelService = new SentinelService()
