import type { StrategicQuestionId, Conclusion, IntelligenceBrief } from '@/intelligence/types'
import type { SourceQueryParams } from '@/sources/types'

export interface CopilotQuery {
  territoryId: string
  questionId: StrategicQuestionId
  context?: string
}

export interface CopilotService {
  generateBrief(territoryId: string): Promise<IntelligenceBrief>
  answerQuestion(query: CopilotQuery): Promise<Conclusion>
  getAvailableSources(params: SourceQueryParams): Promise<string[]>
}

class CopilotServiceStub implements CopilotService {
  async generateBrief(territoryId: string): Promise<IntelligenceBrief> {
    return {
      id: `brief-${territoryId}`,
      territoryId,
      generatedAt: new Date().toISOString(),
      conclusions: [],
      hypotheses: [],
      strategies: [],
      overallConfidence: 'insufficient',
    }
  }

  async answerQuestion(query: CopilotQuery): Promise<Conclusion> {
    return {
      id: `conclusion-${query.questionId}`,
      answer: '',
      reasoning: '',
      evidence: [],
      confidence: 'insufficient',
      generatedAt: new Date().toISOString(),
      questionId: query.questionId,
    }
  }

  async getAvailableSources(_params: SourceQueryParams): Promise<string[]> {
    return []
  }
}

export const copilotService = new CopilotServiceStub()
