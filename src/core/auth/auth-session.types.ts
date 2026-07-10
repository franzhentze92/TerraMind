import type { RequestAuthContext } from '@/core/auth/permissions'

export type AuthSessionState =
  | 'active'
  | 'invited'
  | 'awaiting_access'
  | 'suspended'
  | 'revoked'

export interface AuthMeResponse {
  state: AuthSessionState
  context: RequestAuthContext | null
  profile: {
    id: string
    email: string
    display_name: string
    provisioning_status: string
    is_platform_admin: boolean
  } | null
  organizations: Array<{ id: string; name: string; slug: string; membership_status: string }>
}
