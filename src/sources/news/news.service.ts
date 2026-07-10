import { BaseSourceService } from '@/sources/types'

class NewsService extends BaseSourceService {
  readonly sourceType = 'news' as const
  readonly sourceName = 'Official News Feeds'
}

export const newsService = new NewsService()
