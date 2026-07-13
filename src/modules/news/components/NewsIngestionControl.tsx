import { useEffect, useRef, useState } from 'react'
import { ChevronDown, History, Loader2, RefreshCw, Settings2 } from 'lucide-react'
import { useNewsIngestionRuns, useRunPrensaLibreIngestion } from '../hooks/useNews'

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'sin registro'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'sin registro'
  const diffMs = Date.now() - then
  const min = Math.round(diffMs / 60000)
  if (min < 1) return 'hace instantes'
  if (min < 60) return `hace ${min} minuto${min === 1 ? '' : 's'}`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} hora${h === 1 ? '' : 's'}`
  const d = Math.round(h / 24)
  return `hace ${d} día${d === 1 ? '' : 's'}`
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })
}

interface NewsIngestionControlProps {
  canIngest: boolean
  hasRuns: boolean
  lastIngestionAt: string | null
}

export function NewsIngestionControl({ canIngest, hasRuns, lastIngestionAt }: NewsIngestionControlProps) {
  const mutation = useRunPrensaLibreIngestion()
  const [menuOpen, setMenuOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const runsQuery = useNewsIngestionRuns(historyOpen)

  useEffect(() => {
    if (!menuOpen) return
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  if (!canIngest) {
    return (
      <p className="text-xs text-text-tertiary">
        Última ingesta: {formatRelative(lastIngestionAt)}
      </p>
    )
  }

  const primaryLabel = hasRuns ? 'Actualizar noticias' : 'Ejecutar primera ingesta'

  return (
    <div ref={containerRef} className="relative flex flex-col items-end gap-1">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="inline-flex items-center gap-2 rounded-l-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm text-text-primary disabled:opacity-60"
        >
          {mutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          {primaryLabel}
        </button>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="inline-flex items-center rounded-r-lg border border-l-0 border-accent/40 bg-accent/10 px-1.5 py-1.5 text-text-primary"
          aria-label="Más opciones de ingesta"
        >
          <ChevronDown size={15} />
        </button>
      </div>

      {hasRuns && (
        <p className="text-[11px] text-text-tertiary">Última ingesta: {formatRelative(lastIngestionAt)}</p>
      )}

      {menuOpen && (
        <div className="absolute right-0 top-9 z-20 w-56 rounded-lg border border-border-subtle bg-surface-1 p-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              mutation.mutate()
              setMenuOpen(false)
            }}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-text-primary hover:bg-surface-2"
          >
            <RefreshCw size={14} /> Actualizar ahora
          </button>
          <button
            type="button"
            onClick={() => {
              setHistoryOpen(true)
              setMenuOpen(false)
            }}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-text-primary hover:bg-surface-2"
          >
            <History size={14} /> Ver historial de ingestas
          </button>
          <button
            type="button"
            disabled
            className="flex w-full cursor-not-allowed items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-text-tertiary"
          >
            <Settings2 size={14} /> Administrar fuentes
            <span className="ml-auto text-[10px]">Próximamente</span>
          </button>
        </div>
      )}

      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setHistoryOpen(false)}>
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border-subtle bg-surface-1 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">Historial de ingestas</h2>
              <button type="button" onClick={() => setHistoryOpen(false)} className="text-xs text-text-secondary">
                Cerrar
              </button>
            </div>
            {runsQuery.isLoading ? (
              <p className="text-sm text-text-secondary">Cargando historial…</p>
            ) : (runsQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-text-secondary">Todavía no hay corridas registradas.</p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="text-text-tertiary">
                  <tr className="border-b border-border-subtle">
                    <th className="py-2 pr-2">Fecha</th>
                    <th className="py-2 pr-2">Resultado</th>
                    <th className="py-2 pr-2">Nuevos</th>
                    <th className="py-2 pr-2">Actualizados</th>
                    <th className="py-2 pr-2">Dupl. sin descarga</th>
                    <th className="py-2 pr-2">HTTP evitadas</th>
                  </tr>
                </thead>
                <tbody className="text-text-secondary">
                  {(runsQuery.data ?? []).map((run) => (
                    <tr key={run.id} className="border-b border-border-subtle/60">
                      <td className="py-2 pr-2">{formatDateTime(run.finished_at ?? run.started_at)}</td>
                      <td className="py-2 pr-2">{run.message ?? run.result_code}</td>
                      <td className="py-2 pr-2">{run.documents_new}</td>
                      <td className="py-2 pr-2">{run.documents_updated}</td>
                      <td className="py-2 pr-2">{run.duplicates}</td>
                      <td className="py-2 pr-2">{run.http_requests_avoided}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
