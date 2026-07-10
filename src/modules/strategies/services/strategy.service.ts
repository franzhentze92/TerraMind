import type { StrategyRecommendation } from '@/intelligence/types'

export interface StrategyService {
  getRecommendations(territoryId: string): Promise<StrategyRecommendation[]>
  getRecommendationById(id: string): Promise<StrategyRecommendation | null>
}

class StrategyServiceStub implements StrategyService {
  async getRecommendations(_territoryId: string): Promise<StrategyRecommendation[]> {
    return []
  }

  async getRecommendationById(_id: string): Promise<StrategyRecommendation | null> {
    return null
  }
}

export const strategyService = new StrategyServiceStub()
