import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '@/core/auth/AuthProvider'
import { resetLoginRedirectGuard } from '@/core/auth/auth-session-events'
import { getSupabaseBrowserClient } from '@/core/auth/supabase-client'

export function LoginPage() {
  const { signIn, status, loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const supabaseConfigured = Boolean(getSupabaseBrowserClient())

  const from = (location.state as { from?: string } | null)?.from ?? '/situacion'
  const reason = searchParams.get('reason')

  if (!loading && status === 'awaiting_access') {
    return <Navigate to="/espera-acceso" replace />
  }

  if (!loading && status === 'authenticated' && reason !== 'unauthorized') {
    resetLoginRedirectGuard()
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
            if (!r.ok) {
              setError(r.error ?? 'Error de autenticación')
              return
            }
            resetLoginRedirectGuard()
            navigate(from, { replace: true })
          })
        }}
      >
        <h1 className="text-lg font-medium text-text-primary">TerraMind</h1>
        <p className="mt-1 text-sm text-text-secondary">Inicie sesión con Supabase Auth</p>
        {!supabaseConfigured && (
          <p className="mt-3 rounded border border-confidence-low/40 bg-confidence-low/10 px-3 py-2 text-xs text-confidence-low">
            Supabase no está disponible en el frontend. Verifique que <code>SUPABASE_URL</code> y{' '}
            <code>SUPABASE_ANON_KEY</code> existan en <code>.env</code> y reinicie{' '}
            <code>npm run dev</code>.
          </p>
        )}
        {reason === 'unauthorized' && (
          <p className="mt-3 text-xs text-confidence-low">Sesión expirada. Vuelva a iniciar sesión.</p>
        )}
        {reason === 'session_expired' && (
          <p className="mt-3 text-xs text-confidence-low">Su sesión expiró. Inicie sesión nuevamente.</p>
        )}
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
          disabled={submitting || !supabaseConfigured}
          className="mt-4 w-full rounded-lg bg-accent px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="mt-4 text-xs text-text-tertiary">
          Use su usuario administrador provisionado en Supabase Auth. Si olvidó la contraseña, restablézcala
          desde el panel de Supabase o mediante recuperación por correo.
        </p>
        <Link to="/situacion" className="mt-2 inline-block text-xs text-accent">
          Volver
        </Link>
      </form>
    </div>
  )
}
