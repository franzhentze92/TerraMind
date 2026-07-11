import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

import { useAuthStore, purgeLegacyAuthStorage } from '@/core/auth/auth.store'
import type { RequestAuthContext } from '@/core/auth/permissions'
import type { AuthMeResponse, AuthSessionState } from '@/core/auth/auth-session.types'
import { getSupabaseBrowserClient } from '@/core/auth/supabase-client'
import type { AuthStatus } from '@/core/auth/auth-status'
import { clearAuthSession, invalidateFullAuthSession, resetLoginRedirectGuard } from '@/core/auth/auth-session-events'

interface AuthContextValue {
  loading: boolean
  status: AuthStatus
  isAuthenticated: boolean
  sessionState: AuthSessionState | null
  authContext: RequestAuthContext | null
  accessToken: string | null
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  signOut: () => Promise<void>
  refreshMe: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function isRuntimeTestToken(token: string | null | undefined): boolean {
  return Boolean(token?.startsWith('test-'))
}

function purgeStalePersistedSession(): void {
  const store = useAuthStore.getState()
  if (isRuntimeTestToken(store.accessToken)) {
    store.clearSession()
  }
}

async function fetchAuthMe(token: string, organizationId?: string): Promise<AuthMeResponse | null> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (organizationId) headers['X-Terramind-Organization-Id'] = organizationId
  const res = await fetch('/api/auth/me', { headers, credentials: 'include' })
  if (!res.ok) return null
  return (await res.json()) as AuthMeResponse
}

async function fetchAuthMeWithRetry(token: string): Promise<AuthMeResponse | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const me = await fetchAuthMe(token)
    if (me) return me
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)))
    }
  }
  return null
}

function resolveStatus(session: AuthMeResponse | null): AuthStatus {
  if (!session) return 'unauthenticated'
  if (session.state === 'awaiting_access') return 'awaiting_access'
  if (session.state === 'suspended' || session.state === 'revoked') return 'forbidden'
  if (session.context) return 'authenticated'
  return 'unauthenticated'
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken)
  const authContext = useAuthStore((s) => s.authContext)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [sessionState, setSessionState] = useState<AuthSessionState | null>(null)
  const syncInFlight = useRef<Promise<void> | null>(null)

  const applySession = useCallback((token: string | null, session: AuthMeResponse | null) => {
    const store = useAuthStore.getState()
    if (!token || !session) {
      clearAuthSession()
      setSessionState(null)
      setStatus('unauthenticated')
      return
    }
    setSessionState(session.state)
    store.setOrganizations(session.organizations.map((o) => ({ id: o.id, name: o.name })))
    if (session.context) {
      store.setSession(token, session.context)
    } else {
      store.setAccessToken(token)
    }
    setStatus(resolveStatus(session))
  }, [])

  const syncFromSupabaseSession = useCallback(
    async (session: Session | null) => {
      if (!session?.access_token || isRuntimeTestToken(session.access_token)) {
        applySession(null, null)
        return
      }
      const me = await fetchAuthMeWithRetry(session.access_token)
      if (!me) {
        const store = useAuthStore.getState()
        if (store.authContext && store.accessToken === session.access_token) {
          setStatus('authenticated')
          return
        }
        applySession(null, null)
        return
      }
      if (!me.context && me.state !== 'awaiting_access') {
        applySession(null, null)
        return
      }
      applySession(session.access_token, me)
      resetLoginRedirectGuard()
    },
    [applySession],
  )

  const refreshMe = useCallback(async () => {
    if (syncInFlight.current) {
      await syncInFlight.current
      return
    }
    syncInFlight.current = (async () => {
      setStatus('loading')
      purgeStalePersistedSession()
      clearAuthSession()
      const client = getSupabaseBrowserClient()
      if (!client) {
        applySession(null, null)
        return
      }
      const { data, error } = await client.auth.getSession()
      if (error) {
        applySession(null, null)
        return
      }
      await syncFromSupabaseSession(data.session)
    })().finally(() => {
      syncInFlight.current = null
    })
    await syncInFlight.current
  }, [applySession, syncFromSupabaseSession])

  useEffect(() => {
    purgeLegacyAuthStorage()
    void refreshMe()
    const client = getSupabaseBrowserClient()
    if (!client) return

    const { data: sub } = client.auth.onAuthStateChange((event: AuthChangeEvent, session) => {
      if (event === 'INITIAL_SESSION') return
      if (event === 'SIGNED_OUT') {
        applySession(null, null)
        return
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        void syncFromSupabaseSession(session)
      }
    })

    return () => sub.subscription.unsubscribe()
  }, [applySession, refreshMe, syncFromSupabaseSession])

  const signIn = useCallback(
    async (email: string, password: string) => {
      const client = getSupabaseBrowserClient()
      if (!client) {
        return { ok: false, error: 'Supabase no configurado en el frontend (VITE_SUPABASE_*).' }
      }
      const { data, error } = await client.auth.signInWithPassword({ email, password })
      if (error || !data.session?.access_token) {
        return { ok: false, error: error?.message ?? 'Login fallido' }
      }
      await syncFromSupabaseSession(data.session)
      const store = useAuthStore.getState()
      if (!store.authContext) {
        return { ok: false, error: 'No se pudo resolver la sesión operativa (/api/auth/me).' }
      }
      return { ok: true }
    },
    [syncFromSupabaseSession],
  )

  const signOut = useCallback(async () => {
    try {
      await invalidateFullAuthSession()
    } finally {
      applySession(null, null)
      resetLoginRedirectGuard()
      if (typeof window !== 'undefined') {
        window.location.assign('/login')
      }
    }
  }, [applySession])

  const loading = status === 'loading'
  const isAuthenticated = status === 'authenticated' || status === 'awaiting_access'

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      status,
      isAuthenticated,
      sessionState,
      authContext,
      accessToken,
      signIn,
      signOut,
      refreshMe,
    }),
    [loading, status, isAuthenticated, sessionState, authContext, accessToken, signIn, signOut, refreshMe],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function useHasPermission(permission: string): boolean {
  const { authContext, status } = useAuth()
  if (status !== 'authenticated' || !authContext) return false
  if (authContext.isPlatformAdmin) return true
  return authContext.permissions.includes(permission as never)
}
