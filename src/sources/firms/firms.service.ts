import { BaseSourceService } from '@/sources/types'

class FirmsService extends BaseSourceService {
  readonly sourceType = 'firms' as const
  readonly sourceName = 'NASA FIRMS'
}

export const firmsService = new FirmsService()
