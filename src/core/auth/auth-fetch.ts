import { useAuthStore } from '@/core/auth/auth.store'

export function buildAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const { accessToken, authContext } = useAuthStore.getState()
  const headers: Record<string, string> = { ...extra }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  if (authContext?.activeOrganizationId) {
    headers['X-Terramind-Organization-Id'] = authContext.activeOrganizationId
  }
  return headers
}

export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = buildAuthHeaders(
    init?.headers ? Object.fromEntries(new Headers(init.headers).entries()) : undefined,
  )
  return fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  })
}
