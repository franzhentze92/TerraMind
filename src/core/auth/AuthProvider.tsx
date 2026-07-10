import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { useAuthStore } from '@/core/auth/auth.store'
import type { RequestAuthContext } from '@/core/auth/permissions'
import { getSupabaseBrowserClient } from '@/core/auth/supabase-client'

interface AuthContextValue {
  loading: boolean
  isAuthenticated: boolean
  authContext: RequestAuthContext | null
  accessToken: string | null
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  signOut: () => Promise<void>
  refreshMe: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchAuthMe(token: string, organizationId?: string): Promise<RequestAuthContext | null> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (organizationId) headers['X-Terramind-Organization-Id'] = organizationId
  const res = await fetch('/api/auth/me', { headers, credentials: 'include' })
  if (!res.ok) return null
  const data = (await res.json()) as { context: RequestAuthContext }
  return data.context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const store = useAuthStore()
  const [loading, setLoading] = useState(true)

  const refreshMe = useCallback(async () => {
    const client = getSupabaseBrowserClient()
    if (!client) {
      setLoading(false)
      return
    }
    const { data } = await client.auth.getSession()
    const token = data.session?.access_token
    if (!token) {
      store.clearSession()
      setLoading(false)
      return
    }
    const ctx = await fetchAuthMe(token, store.authContext?.activeOrganizationId)
    if (!ctx) {
      store.clearSession()
      setLoading(false)
      return
    }
    store.setSession(token, ctx)
    setLoading(false)
  }, [store])

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
      const ctx = await fetchAuthMe(data.session.access_token)
      if (!ctx) return { ok: false, error: 'Perfil no provisionado' }
      store.setSession(data.session.access_token, ctx)
      return { ok: true }
    },
    [store],
  )

  const signOut = useCallback(async () => {
    const client = getSupabaseBrowserClient()
    if (client) await client.auth.signOut()
    store.clearSession()
  }, [store])

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      isAuthenticated: Boolean(store.accessToken && store.authContext),
      authContext: store.authContext,
      accessToken: store.accessToken,
      signIn,
      signOut,
      refreshMe,
    }),
    [loading, store.accessToken, store.authContext, signIn, signOut, refreshMe],
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
