export type AuthStatus =
  | 'loading'
  | 'authenticated'
  | 'unauthenticated'
  | 'awaiting_access'
  | 'forbidden'

export function isAuthOperational(status: AuthStatus): boolean {
  return status === 'authenticated'
}

export function isAuthGateOpen(status: AuthStatus): boolean {
  return status === 'unauthenticated' || status === 'awaiting_access' || status === 'forbidden'
}
