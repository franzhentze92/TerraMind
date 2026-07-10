import { useAuth } from '@/core/auth/AuthProvider'

export function AwaitingAccessPage() {
  const { signOut } = useAuth()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Acceso pendiente</h1>
      <p className="max-w-md text-muted-foreground">
        Su cuenta está autenticada, pero aún no tiene una invitación activa ni membership en una
        organización. Contacte a un administrador o use el enlace de invitación que recibió.
      </p>
      <button type="button" className="rounded border px-4 py-2" onClick={() => void signOut()}>
        Cerrar sesión
      </button>
    </div>
  )
}
