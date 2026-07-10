import type { SourceService } from '@/sources/types'
import { sentinelService } from '@/sources/sentinel/sentinel.service'
import { climateService } from '@/sources/climate/climate.service'
import { firmsService } from '@/sources/firms/firms.service'
import { newsService } from '@/sources/news/news.service'
import { soilService } from '@/sources/soil/soil.service'

export const sourceRegistry: SourceService[] = [
  sentinelService,
  climateService,
  firmsService,
  newsService,
  soilService,
]

export async function checkAllSourcesHealth() {
  return Promise.all(sourceRegistry.map((s) => s.healthCheck()))
}
