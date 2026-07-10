export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'insufficient'

export type SourceType =
  | 'sentinel'
  | 'climate'
  | 'firms'
  | 'news'
  | 'soil'
  | 'hydrology'
  | 'official'

export interface TerritoryContext {
  countryCode: string
  countryName: string
  region?: string
  timezone: string
  activeSince: string
}

export interface Evidence {
  id: string
  source: SourceType
  sourceName: string
  timestamp: string
  title: string
  summary: string
  rawReference: string
  confidence: ConfidenceLevel
  metadata?: Record<string, unknown>
}

export interface Indicator {
  id: string
  name: string
  value: number | string
  unit: string
  source: SourceType
  sourceName: string
  computedAt: string
  territoryId: string
  trend?: 'rising' | 'falling' | 'stable' | 'volatile'
  metadata?: Record<string, unknown>
}

export interface Hypothesis {
  id: string
  claim: string
  supportingEvidence: Evidence[]
  contradictingEvidence: Evidence[]
  confidence: ConfidenceLevel
  generatedAt: string
  status: 'active' | 'validated' | 'refuted' | 'superseded'
}

export interface Conclusion {
  id: string
  answer: string
  reasoning: string
  evidence: Evidence[]
  confidence: ConfidenceLevel
  generatedAt: string
  questionId: StrategicQuestionId
}

export type StrategicQuestionId =
  | 'what-is-happening'
  | 'why-is-it-happening'
  | 'what-could-happen'
  | 'what-deserves-attention'
  | 'what-strategies'

export interface StrategicQuestion {
  id: StrategicQuestionId
  question: string
  description: string
  order: number
}

export interface StrategyRecommendation {
  id: string
  title: string
  description: string
  rationale: string
  evidence: Evidence[]
  confidence: ConfidenceLevel
  priority: 'critical' | 'high' | 'medium' | 'low'
  timeframe: 'immediate' | 'short-term' | 'medium-term' | 'long-term'
  generatedAt: string
}

export interface IntelligenceBrief {
  id: string
  territoryId: string
  generatedAt: string
  conclusions: Conclusion[]
  hypotheses: Hypothesis[]
  strategies: StrategyRecommendation[]
  overallConfidence: ConfidenceLevel
}
