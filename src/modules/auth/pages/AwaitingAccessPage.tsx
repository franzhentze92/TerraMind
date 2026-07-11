import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '@/core/auth/AuthProvider'

export function AwaitingAccessPage() {
  const { signOut, status, loading, refreshMe } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    void refreshMe()
  }, [refreshMe])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-sm text-muted-foreground">
        Verificando sesión…
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />
  }

  if (status === 'authenticated') {
    return <Navigate to="/situacion" replace />
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
    } catch {
      setSigningOut(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Acceso pendiente</h1>
      <p className="max-w-md text-muted-foreground">
        Su cuenta está autenticada, pero aún no tiene una invitación activa ni membership en una
        organización. Contacte a un administrador o use el enlace de invitación que recibió.
      </p>
      <button
        type="button"
        className="rounded border px-4 py-2 disabled:opacity-50"
        disabled={signingOut}
        onClick={() => void handleSignOut()}
      >
        {signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
      </button>
    </div>
  )
}
