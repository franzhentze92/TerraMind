import { Link } from 'react-router-dom'

export function ForbiddenPage() {
  return (
    <div className="mx-auto max-w-lg p-8 text-center">
      <h1 className="text-xl font-medium text-text-primary">403 — Acceso denegado</h1>
      <p className="mt-2 text-sm text-text-secondary">
        No tiene permisos para ver este recurso en la organización activa.
      </p>
      <Link to="/situacion" className="mt-4 inline-block text-sm text-accent">
        Ir al inicio
      </Link>
    </div>
  )
}
