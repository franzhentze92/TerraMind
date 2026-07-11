import { useAuth } from '@/core/auth/AuthProvider'
import { isAuthOperational } from '@/core/auth/auth-status'

/** True when AuthProvider finished loading and the user has an active org session. */
export function useAuthQueryReady(): boolean {
  const { status, authContext } = useAuth()
  return isAuthOperational(status) && Boolean(authContext?.activeOrganizationId)
}
