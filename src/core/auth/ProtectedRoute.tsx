import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '@/core/auth/AuthProvider'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loading, status } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-text-secondary">
        Verificando sesión…
      </div>
    )
  }

  if (status !== 'authenticated') {
    if (status === 'unauthenticated') {
      return <Navigate to="/login" replace state={{ from: location.pathname }} />
    }
    if (status === 'awaiting_access') {
      return <Navigate to="/espera-acceso" replace />
    }
    return <Navigate to="/403" replace />
  }

  return children
}
