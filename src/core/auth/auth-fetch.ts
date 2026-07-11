import { getSupabaseBrowserClient } from '@/core/auth/supabase-client'
import { useAuthStore } from '@/core/auth/auth.store'
import { clearAuthSession, scheduleLoginRedirect } from '@/core/auth/auth-session-events'

let refreshInFlight: Promise<string | null> | null = null
let refreshBlockedUntil = 0

const REFRESH_COOLDOWN_MS = 30_000

function devAuthLog(message: string, meta?: Record<string, unknown>) {
  if (!import.meta.env.DEV) return
  console.debug(`[auth-fetch] ${message}`, meta ?? {})
}

function isRuntimeTestToken(token: string | null | undefined): boolean {
  return Boolean(token?.startsWith('test-'))
}

export async function resolveAccessToken(): Promise<string | null> {
  const store = useAuthStore.getState()
  const client = getSupabaseBrowserClient()

  if (client) {
    const { data, error } = await client.auth.getSession()
    if (error) devAuthLog('getSession error', { message: error.message })
    const supabaseToken = data.session?.access_token ?? null
    if (supabaseToken) {
      if (store.accessToken !== supabaseToken) {
        useAuthStore.getState().setAccessToken(supabaseToken)
      }
      return supabaseToken
    }
    if (store.accessToken && !isRuntimeTestToken(store.accessToken)) {
      clearAuthSession()
    }
    return null
  }

  if (isRuntimeTestToken(store.accessToken)) {
    clearAuthSession()
  }
  return store.accessToken
}

async function refreshAccessToken(): Promise<string | null> {
  const now = Date.now()
  if (now < refreshBlockedUntil) {
    devAuthLog('refreshSession skipped — cooldown active')
    return null
  }
  if (refreshInFlight) return refreshInFlight

  const client = getSupabaseBrowserClient()
  if (!client) {
    return null
  }


  refreshInFlight = (async () => {
    try {
      const { data, error } = await client.auth.refreshSession()
      if (error) {
        devAuthLog('refreshSession failed', { message: error.message })
        refreshBlockedUntil = Date.now() + REFRESH_COOLDOWN_MS
        return null
      }
      const token = data.session?.access_token ?? null
      if (token) useAuthStore.getState().setAccessToken(token)
      refreshBlockedUntil = 0
      return token
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

async function operationalSessionValid(token: string): Promise<boolean> {
  const res = await fetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  })
  if (!res.ok) return false
  const me = (await res.json()) as { context?: unknown }
  return Boolean(me.context)
}

export function buildAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const { accessToken } = useAuthStore.getState()
  const headers: Record<string, string> = { ...extra }
  if (accessToken && !isRuntimeTestToken(accessToken)) {
    headers.Authorization = `Bearer ${accessToken}`
  }
  return headers
}

async function buildAuthHeadersAsync(extra?: Record<string, string>): Promise<Record<string, string>> {
  const token = await resolveAccessToken()
  const headers: Record<string, string> = { ...extra }
  delete headers['X-Terramind-Organization-Id']
  delete headers['x-terramind-organization-id']
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function handleUnauthorized(url: string, response: Response): Promise<Response> {
  const token = await resolveAccessToken()
  if (token && (await operationalSessionValid(token))) {
    devAuthLog('401 but operational session still valid — not redirecting', { url })
    return response
  }

  scheduleLoginRedirect('unauthorized')
  return response
}

export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const extra = init?.headers ? Object.fromEntries(new Headers(init.headers).entries()) : undefined
  let headers = await buildAuthHeadersAsync(extra)
  const hasSession = Boolean(headers.Authorization)

  devAuthLog('request', {
    url,
    session: hasSession ? 'yes' : 'no',
  })

  let response = await fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  })

  if (response.status !== 401) return response

  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/login')) {
    return response
  }

  const token = await resolveAccessToken()
  if (token && (await operationalSessionValid(token))) {
    devAuthLog('401 with valid session — retry without org header', { url })
    const retryHeaders: Record<string, string> = { Authorization: `Bearer ${token}` }
    const retry = await fetch(input, {
      ...init,
      headers: retryHeaders,
      credentials: 'include',
    })
    if (retry.status !== 401) return retry
  }

  devAuthLog('401 received, attempting refresh', { url })
  const refreshed = await refreshAccessToken()
  if (!refreshed) {
    return handleUnauthorized(url, response)
  }

  headers = await buildAuthHeadersAsync(extra)
  response = await fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  })

  if (response.status === 401) {
    devAuthLog('401 after refresh', { url })
    return handleUnauthorized(url, response)
  }

  return response
}
