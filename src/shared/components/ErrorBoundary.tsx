import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Short label for the failed section (shown to users). */
  section?: string
  onRetry?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  errorId: string | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, errorId: null }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return {
      hasError: true,
      errorId: `err-${Date.now().toString(36)}`,
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[TerraMind ErrorBoundary]', this.props.section ?? 'app', error, info.componentStack)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, errorId: null })
    this.props.onRetry?.()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        className="flex min-h-[12rem] flex-col items-start justify-center gap-3 rounded-xl border border-border-subtle bg-surface-2/40 p-6"
        role="alert"
        aria-live="assertive"
      >
        <h2 className="text-base font-medium text-text-primary">
          No se pudo cargar {this.props.section ?? 'esta sección'}
        </h2>
        <p className="text-sm text-text-secondary">
          El resto de la aplicación sigue disponible. Puede reintentar o volver al inicio.
        </p>
        {this.state.errorId && (
          <p className="text-xs text-text-tertiary">Referencia: {this.state.errorId}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={this.handleRetry}
            className="rounded-md bg-accent/20 px-3 py-1.5 text-xs text-accent"
          >
            Reintentar
          </button>
          <Link to="/situacion" className="rounded-md border border-border-subtle px-3 py-1.5 text-xs">
            Ir a Situación Nacional
          </Link>
        </div>
      </div>
    )
  }
}
