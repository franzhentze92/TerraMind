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
    if (!response.ok) throw new Error(`API error: ${response.status}`)
    return response.json() as Promise<T>
  }

  async post<T>(endpoint: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeout),
    })
    if (!response.ok) throw new Error(`API error: ${response.status}`)
    return response.json() as Promise<T>
  }
}

export const apiClient = new ApiClient()
