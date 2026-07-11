import { getSupabaseBrowserClient } from '@/core/auth/supabase-client'
import { useAuthStore } from '@/core/auth/auth.store'

let redirectScheduled = false

export function clearAuthSession(): void {
  useAuthStore.getState().clearSession()
}

/** Clears persisted app session and Supabase local auth storage. */
export async function invalidateFullAuthSession(): Promise<void> {
  clearAuthSession()
  const client = getSupabaseBrowserClient()
  if (!client) return
  try {
    await client.auth.signOut({ scope: 'local' })
  } catch {
    // Ignore network/offline failures — local store is already cleared.
  }
}

export function scheduleLoginRedirect(reason = 'session_expired'): void {
  if (typeof window === 'undefined') return
  if (redirectScheduled) return
  if (window.location.pathname.startsWith('/login')) return
  redirectScheduled = true
  void invalidateFullAuthSession().finally(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams({ reason })
    window.location.assign(`/login?${params.toString()}`)
  })
}

export function resetLoginRedirectGuard(): void {
  redirectScheduled = false
}
