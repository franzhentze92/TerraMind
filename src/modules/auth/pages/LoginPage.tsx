import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '@/core/auth/AuthProvider'

export function LoginPage() {
  const { signIn, isAuthenticated, loading } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/situacion'

  if (!loading && isAuthenticated) {
    return <Navigate to={from} replace />
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-0 p-4">
      <form
        className="w-full max-w-sm rounded-xl border border-border-subtle bg-surface-1 p-6 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault()
          setSubmitting(true)
          setError(null)
          void signIn(email, password).then((r) => {
            setSubmitting(false)
            if (!r.ok) setError(r.error ?? 'Error de autenticación')
          })
        }}
      >
        <h1 className="text-lg font-medium text-text-primary">TerraMind</h1>
        <p className="mt-1 text-sm text-text-secondary">Inicie sesión con Supabase Auth</p>
        <label className="mt-4 block text-xs text-text-tertiary">
          Correo
          <input
            type="email"
            className="mt-1 w-full rounded border border-border-subtle bg-surface-0 px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </label>
        <label className="mt-3 block text-xs text-text-tertiary">
          Contraseña
          <input
            type="password"
            className="mt-1 w-full rounded border border-border-subtle bg-surface-0 px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        {error && <p className="mt-3 text-xs text-confidence-low">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="mt-4 w-full rounded-lg bg-accent px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="mt-4 text-xs text-text-tertiary">
          Sin credenciales configuradas, use modo desarrollo con <code>AUTH_ENFORCE=false</code>.
        </p>
        <Link to="/situacion" className="mt-2 inline-block text-xs text-accent">
          Volver
        </Link>
      </form>
    </div>
  )
}
