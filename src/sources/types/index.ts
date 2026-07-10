import type { Indicator, SourceType } from '@/intelligence/types'

export interface SourceQueryParams {
  territoryId: string
  startDate?: string
  endDate?: string
  limit?: number
}

export interface SourceService<T = Indicator> {
  readonly sourceType: SourceType
  readonly sourceName: string
  isAvailable(): Promise<boolean>
  fetchIndicators(params: SourceQueryParams): Promise<T[]>
  healthCheck(): Promise<SourceHealthStatus>
}

export interface SourceHealthStatus {
  source: SourceType
  status: 'healthy' | 'degraded' | 'unavailable'
  lastChecked: string
  latencyMs?: number
  message?: string
}

export abstract class BaseSourceService implements SourceService {
  abstract readonly sourceType: SourceType
  abstract readonly sourceName: string

  async isAvailable(): Promise<boolean> {
    const health = await this.healthCheck()
    return health.status !== 'unavailable'
  }

  async fetchIndicators(_params: SourceQueryParams): Promise<Indicator[]> {
    return []
  }

  async healthCheck(): Promise<SourceHealthStatus> {
    return {
      source: this.sourceType,
      status: 'unavailable',
      lastChecked: new Date().toISOString(),
      message: 'Service not connected — stub implementation',
    }
  }
}
