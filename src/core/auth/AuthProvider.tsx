import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { useAuthStore } from '@/core/auth/auth.store'
import type { RequestAuthContext } from '@/core/auth/permissions'
import type { AuthMeResponse, AuthSessionState } from '@/core/auth/auth-session.types'
import { getSupabaseBrowserClient } from '@/core/auth/supabase-client'

interface AuthContextValue {
  loading: boolean
  isAuthenticated: boolean
  sessionState: AuthSessionState | null
  authContext: RequestAuthContext | null
  accessToken: string | null
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  signOut: () => Promise<void>
  refreshMe: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchAuthMe(token: string, organizationId?: string): Promise<AuthMeResponse | null> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (organizationId) headers['X-Terramind-Organization-Id'] = organizationId
  const res = await fetch('/api/auth/me', { headers, credentials: 'include' })
  if (!res.ok) return null
  return (await res.json()) as AuthMeResponse
}

function isTestBearer(token: string | null | undefined): token is string {
  return Boolean(token?.startsWith('test-'))
}

function readPersistedAccessToken(): string | null {
  const fromStore = useAuthStore.getState().accessToken
  if (fromStore) return fromStore
  try {
    const raw = localStorage.getItem('terramind-auth-v1')
    if (!raw) return null
    const parsed = JSON.parse(raw) as { state?: { accessToken?: string | null } }
    return parsed.state?.accessToken ?? null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const store = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [sessionState, setSessionState] = useState<AuthSessionState | null>(null)

  const applySession = useCallback(
    (token: string | null, session: AuthMeResponse | null) => {
      if (!token || !session) {
        store.clearSession()
        setSessionState(null)
        return
      }
      setSessionState(session.state)
      store.setOrganizations(
        session.organizations.map((o) => ({ id: o.id, name: o.name })),
      )
      if (session.context) {
        store.setSession(token, session.context)
      } else {
        store.setAccessToken(token)
      }
    },
    [store],
  )

  const refreshMe = useCallback(async () => {
    const persistedToken = readPersistedAccessToken()
    if (isTestBearer(persistedToken)) {
      const session = await fetchAuthMe(persistedToken, store.authContext?.activeOrganizationId)
      if (session?.context) {
        applySession(persistedToken, session)
        setLoading(false)
        return
      }
    }

    const client = getSupabaseBrowserClient()
    if (!client) {
      if (!isTestBearer(persistedToken)) applySession(null, null)
      setLoading(false)
      return
    }
    const { data } = await client.auth.getSession()
    const token = data.session?.access_token
    if (!token) {
      if (!isTestBearer(persistedToken)) applySession(null, null)
      setLoading(false)
      return
    }
    const session = await fetchAuthMe(token, store.authContext?.activeOrganizationId)
    applySession(token, session)
    setLoading(false)
  }, [applySession, store.authContext?.activeOrganizationId])

  useEffect(() => {
    void refreshMe()
    const client = getSupabaseBrowserClient()
    if (!client) {
      setLoading(false)
      return
    }
    const { data: sub } = client.auth.onAuthStateChange(() => {
      void refreshMe()
    })
    return () => sub.subscription.unsubscribe()
  }, [refreshMe])

  const signIn = useCallback(
    async (email: string, password: string) => {
      const client = getSupabaseBrowserClient()
      if (!client) return { ok: false, error: 'Supabase no configurado' }
      const { data, error } = await client.auth.signInWithPassword({ email, password })
      if (error || !data.session?.access_token) {
        return { ok: false, error: error?.message ?? 'Login fallido' }
      }
      const session = await fetchAuthMe(data.session.access_token)
      if (!session) return { ok: false, error: 'No se pudo resolver la sesión' }
      if (session.state === 'awaiting_access') {
        applySession(data.session.access_token, session)
        return { ok: true }
      }
      if (!session.context) {
        return { ok: false, error: 'Perfil no provisionado o membership inactiva' }
      }
      applySession(data.session.access_token, session)
      return { ok: true }
    },
    [applySession],
  )

  const signOut = useCallback(async () => {
    const client = getSupabaseBrowserClient()
    if (client) await client.auth.signOut()
    applySession(null, null)
  }, [applySession])

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      isAuthenticated: Boolean(store.accessToken && (store.authContext || sessionState === 'awaiting_access')),
      sessionState,
      authContext: store.authContext,
      accessToken: store.accessToken,
      signIn,
      signOut,
      refreshMe,
    }),
    [loading, store.accessToken, store.authContext, sessionState, signIn, signOut, refreshMe],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function useHasPermission(permission: string): boolean {
  const { authContext } = useAuth()
  if (!authContext) return false
  if (authContext.isPlatformAdmin) return true
  return authContext.permissions.includes(permission as never)
}
