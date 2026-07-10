import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '@/core/auth/AuthProvider'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated, sessionState } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-text-secondary">
        Verificando sesión…
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (sessionState === 'awaiting_access') {
    return <Navigate to="/espera-acceso" replace />
  }

  if (sessionState === 'revoked' || sessionState === 'suspended') {
    return <Navigate to="/403" replace />
  }

  return children
}
