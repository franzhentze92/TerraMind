export interface AuthUser {
  id: string
  name: string
  email: string
  role: import('@/core/permissions').Role
  organization: string
}

export interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
}

export const authStub: AuthState = {
  user: null,
  isAuthenticated: false,
}
