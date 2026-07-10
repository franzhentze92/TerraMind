export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export interface ApiClientConfig {
  baseUrl: string
  timeout: number
}

const defaultConfig: ApiClientConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: 30_000,
}

export class ApiClient {
  private config: ApiClientConfig

  constructor(config: Partial<ApiClientConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
  }

  get baseUrl() {
    return this.config.baseUrl
  }

  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      signal: AbortSignal.timeout(this.config.timeout),
    })
    if (!response.ok) {
      let message = `API error: ${response.status}`
      try {
        const body = (await response.json()) as { error?: string }
        if (body.error) message = body.error
      } catch {
        // ignore parse errors
      }
      throw new ApiError(message, response.status)
    }
    return response.json() as Promise<T>
  }

  async post<T>(endpoint: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeout),
    })
    if (!response.ok) {
      throw new ApiError(`API error: ${response.status}`, response.status)
    }
    return response.json() as Promise<T>
  }
}

export const apiClient = new ApiClient()
