import { Navigate } from 'react-router-dom'

import { useHasPermission } from '@/core/auth/AuthProvider'

export function PermissionRoute({
  permission,
  children,
}: {
  permission: string
  children: React.ReactNode
}) {
  const allowed = useHasPermission(permission)
  if (!allowed) return <Navigate to="/403" replace />
  return <>{children}</>
}
