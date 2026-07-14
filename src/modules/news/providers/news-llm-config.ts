/**
 * Configuración de proveedores LLM para análisis documental (intercambiable).
 */
export type NewsModelTier = 'fast' | 'deep'

export interface NewsLlmModelConfig {
  provider: string
  modelName: string
  temperature: number
  maxOutputTokens: number
  timeoutMs: number
  retryLimit: number
}

export const NEWS_LLM_CONFIG: Record<NewsModelTier, NewsLlmModelConfig> = {
  fast: {
    provider: 'openai',
    modelName: process.env.NEWS_LLM_FAST_MODEL ?? 'gpt-4o-mini',
    temperature: 0.1,
    maxOutputTokens: 4096,
    timeoutMs: 90_000,
    retryLimit: 1,
  },
  deep: {
    provider: 'openai',
    modelName: process.env.NEWS_LLM_DEEP_MODEL ?? 'gpt-4o',
    temperature: 0.1,
    maxOutputTokens: 8192,
    timeoutMs: 120_000,
    retryLimit: 1,
  },
}

export function isNewsLlmEnabled(): boolean {
  return process.env.NEWS_LLM_ENABLED === 'true' && Boolean(process.env.OPENAI_API_KEY)
}

export function getOpenAiApiKey(): string | null {
  return process.env.OPENAI_API_KEY ?? null
}
