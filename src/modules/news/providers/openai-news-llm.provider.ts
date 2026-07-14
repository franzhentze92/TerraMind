/**
 * Proveedor OpenAI para análisis documental — salida JSON estructurada.
 */
import type { AiAnalysisOutput, AiTriageOutput } from '../schemas/ai-analysis.schema'
import { parseAiAnalysisOutput, parseAiTriageOutput } from '../schemas/ai-analysis.schema'
import {
  FULL_EXTRACTION_USER_PROMPT,
  SYSTEM_INSTRUCTIONS,
  TRIAGE_SYSTEM_INSTRUCTIONS,
  TRIAGE_USER_PROMPT,
  wrapDocumentPayload,
} from './analysis-prompts'
import type { NewsLlmModelConfig } from './news-llm-config'
import { getOpenAiApiKey } from './news-llm-config'

export type LlmCallSuccess<T> = {
  ok: true
  data: T
  raw: unknown
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
}

export type LlmCallFailure = {
  ok: false
  error: string
  raw?: unknown
}

export type LlmCallResult<T> = LlmCallSuccess<T> | LlmCallFailure

async function callOpenAiJson(
  config: NewsLlmModelConfig,
  system: string,
  user: string,
): Promise<{ raw: unknown; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
  const apiKey = getOpenAiApiKey()
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.modelName,
        temperature: config.temperature,
        max_tokens: config.maxOutputTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const errBody = await res.text()
      throw new Error(`OpenAI ${res.status}: ${errBody.slice(0, 500)}`)
    }

    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    }
    const content = body.choices?.[0]?.message?.content
    if (!content) throw new Error('Respuesta vacía del modelo')

    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      throw new Error('El modelo no devolvió JSON válido')
    }

    return {
      raw: parsed,
      usage: {
        promptTokens: body.usage?.prompt_tokens ?? 0,
        completionTokens: body.usage?.completion_tokens ?? 0,
        totalTokens: body.usage?.total_tokens ?? 0,
      },
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function runTriageExtraction(
  config: NewsLlmModelConfig,
  sanitizedDocumentJson: string,
): Promise<LlmCallResult<AiTriageOutput>> {
  try {
    const user = `${TRIAGE_USER_PROMPT}\n\n${wrapDocumentPayload(sanitizedDocumentJson)}`
    const { raw, usage } = await callOpenAiJson(config, TRIAGE_SYSTEM_INSTRUCTIONS, user)
    const parsed = parseAiTriageOutput(raw)
    if (!parsed.ok) return { ok: false, error: parsed.error, raw }
    return { ok: true, data: parsed.data, raw, usage }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error de triaje' }
  }
}

export async function runFullExtraction(
  config: NewsLlmModelConfig,
  sanitizedDocumentJson: string,
): Promise<LlmCallResult<AiAnalysisOutput>> {
  try {
    const user = `${FULL_EXTRACTION_USER_PROMPT}\n\n${wrapDocumentPayload(sanitizedDocumentJson)}`
    let lastError = 'Error de extracción'
    let lastRaw: unknown

    for (let attempt = 0; attempt <= config.retryLimit; attempt++) {
      const { raw, usage } = await callOpenAiJson(config, SYSTEM_INSTRUCTIONS, user)
      lastRaw = raw
      const parsed = parseAiAnalysisOutput(raw)
      if (parsed.ok) {
        return { ok: true, data: parsed.data, raw, usage }
      }
      lastError = parsed.error
      if (attempt < config.retryLimit) {
        const repairUser = `${user}\n\nLa respuesta anterior no cumplió el esquema: ${parsed.error}. Corrige y devuelve solo JSON válido.`
        const repair = await callOpenAiJson(config, SYSTEM_INSTRUCTIONS, repairUser)
        lastRaw = repair.raw
        const repaired = parseAiAnalysisOutput(repair.raw)
        if (repaired.ok) {
          return {
            ok: true,
            data: repaired.data,
            raw: repair.raw,
            usage: {
              promptTokens: usage.promptTokens + repair.usage.promptTokens,
              completionTokens: usage.completionTokens + repair.usage.completionTokens,
              totalTokens: usage.totalTokens + repair.usage.totalTokens,
            },
          }
        }
        lastError = repaired.error
      }
    }

    return { ok: false, error: lastError, raw: lastRaw }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error de extracción' }
  }
}
