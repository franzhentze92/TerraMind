import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { RequestAuthContext } from '@/core/auth/permissions'

export interface AuthSessionState {
  accessToken: string | null
  authContext: RequestAuthContext | null
  organizations: Array<{ id: string; name: string }>
  pendingSyncWarning: boolean
  setSession: (token: string, ctx: RequestAuthContext) => void
  setAccessToken: (token: string) => void
  setOrganizations: (orgs: Array<{ id: string; name: string }>) => void
  setActiveOrganization: (organizationId: string) => void
  setPendingSyncWarning: (value: boolean) => void
  clearSession: () => void
}

export const useAuthStore = create<AuthSessionState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      authContext: null,
      organizations: [],
      pendingSyncWarning: false,
      setSession: (token, ctx) => set({ accessToken: token, authContext: ctx }),
      setAccessToken: (token) => set({ accessToken: token, authContext: null }),
      setOrganizations: (orgs) => set({ organizations: orgs }),
      setActiveOrganization: (organizationId) => {
        const ctx = get().authContext
        if (!ctx) return
        set({
          authContext: { ...ctx, activeOrganizationId: organizationId },
        })
      },
      setPendingSyncWarning: (value) => set({ pendingSyncWarning: value }),
      clearSession: () =>
        set({
          accessToken: null,
          authContext: null,
          organizations: [],
        }),
    }),
    { name: 'terramind-auth-v1' },
  ),
)

export function getFieldLocalIdentityKey(auth: RequestAuthContext | null): string | null {
  if (!auth) return null
  return `${auth.activeOrganizationId}:${auth.userId}`
}
