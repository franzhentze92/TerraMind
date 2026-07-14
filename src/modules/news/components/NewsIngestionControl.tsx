import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, History, Loader2, RefreshCw, Settings2 } from 'lucide-react'
import {
  useEstimateNewsSourceIngestion,
  useNewsIngestionRuns,
  useNewsSources,
  useRunNewsSourceIngestion,
} from '../hooks/useNews'
import type { NewsSourceDto } from '../types/news-dto.types'

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

function discoveryMethodLabel(method: string): string {
  switch (method) {
    case 'news_sitemap':
      return 'News sitemap'
    case 'rss':
      return 'RSS'
    case 'sitemap':
      return 'Sitemap'
    default:
      return method
  }
}

interface NewsIngestionControlProps {
  canIngest: boolean
  hasRuns: boolean
  lastIngestionAt: string | null
}

export function NewsIngestionControl({ canIngest, hasRuns, lastIngestionAt }: NewsIngestionControlProps) {
  const sourcesQuery = useNewsSources()
  const ingestMutation = useRunNewsSourceIngestion()
  const estimateMutation = useEstimateNewsSourceIngestion()
  const [menuOpen, setMenuOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [selectedCode, setSelectedCode] = useState<string>('')
  const [estimateText, setEstimateText] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const runsQuery = useNewsIngestionRuns(historyOpen || sourcesOpen)

  const enabledSources = useMemo(
    () => (sourcesQuery.data ?? []).filter((s) => s.is_enabled),
    [sourcesQuery.data],
  )

  useEffect(() => {
    if (!selectedCode && enabledSources.length > 0) {
      setSelectedCode(enabledSources[0]!.code)
    }
  }, [enabledSources, selectedCode])

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

  const selected = enabledSources.find((s) => s.code === selectedCode) ?? enabledSources[0]
  const primaryLabel = hasRuns ? 'Actualizar noticias' : 'Ejecutar primera ingesta'
  const busy = ingestMutation.isPending || estimateMutation.isPending

  async function onEstimate(source: NewsSourceDto) {
    setEstimateText(null)
    try {
      const report = await estimateMutation.mutateAsync(source.code)
      const method = String(report.selectedDiscoveryMethod ?? source.discovery_method)
      const justification = String(report.discoveryJustification ?? '')
      setEstimateText(
        `${source.name}: estrategia ${discoveryMethodLabel(method)}. ${justification.slice(0, 220)}`,
      )
    } catch (err) {
      setEstimateText(err instanceof Error ? err.message : 'No se pudo estimar')
    }
  }

  return (
    <div ref={containerRef} className="relative flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <select
          value={selected?.code ?? ''}
          onChange={(e) => setSelectedCode(e.target.value)}
          className="rounded-lg border border-border-subtle bg-surface-1 px-2 py-1.5 text-xs"
          aria-label="Fuente a ingerir"
        >
          {enabledSources.map((s) => (
            <option key={s.id} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => selected && ingestMutation.mutate(selected.code)}
            disabled={busy || !selected}
            className="inline-flex items-center gap-2 rounded-l-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm text-text-primary disabled:opacity-60"
          >
            {ingestMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
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
      </div>

      {hasRuns && (
        <p className="text-[11px] text-text-tertiary">Última ingesta: {formatRelative(lastIngestionAt)}</p>
      )}
      {selected?.health_label && (
        <p className="text-[11px] text-text-tertiary">
          {selected.name}: {selected.health_label}
        </p>
      )}
      {estimateText && <p className="max-w-md text-right text-[11px] text-text-secondary">{estimateText}</p>}
      {ingestMutation.isError && (
        <p className="text-[11px] text-red-400">
          {(ingestMutation.error as Error)?.message ?? 'Error de ingesta'}
        </p>
      )}

      {menuOpen && (
        <div className="absolute right-0 top-10 z-20 w-64 rounded-lg border border-border-subtle bg-surface-1 p-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              if (selected) ingestMutation.mutate(selected.code)
              setMenuOpen(false)
            }}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-text-primary hover:bg-surface-2"
          >
            <RefreshCw size={14} /> Ejecutar ingestión
          </button>
          <button
            type="button"
            onClick={() => {
              if (selected) void onEstimate(selected)
              setMenuOpen(false)
            }}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-text-primary hover:bg-surface-2"
          >
            <Settings2 size={14} /> Estimar ingestión
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
            onClick={() => {
              setSourcesOpen(true)
              setMenuOpen(false)
            }}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-text-primary hover:bg-surface-2"
          >
            <Settings2 size={14} /> Estado por fuente
          </button>
        </div>
      )}

      {sourcesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSourcesOpen(false)}>
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border-subtle bg-surface-1 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">Fuentes de noticias</h2>
              <button type="button" onClick={() => setSourcesOpen(false)} className="text-xs text-text-secondary">
                Cerrar
              </button>
            </div>
            <div className="space-y-3">
              {(sourcesQuery.data ?? []).map((source) => {
                const latest = (runsQuery.data ?? []).find((r) => r.source_id === source.id)
                return (
                  <div key={source.id} className="rounded-lg border border-border-subtle px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{source.name}</p>
                        <p className="text-[11px] text-text-tertiary">
                          {source.attribution_label ?? 'Fuente periodística'} ·{' '}
                          {discoveryMethodLabel(source.discovery_method)} ·{' '}
                          {source.health_label ?? 'Sin estado'}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          className="rounded-md border border-border-subtle px-2 py-1 text-[11px]"
                          onClick={() => void onEstimate(source)}
                        >
                          Estimar
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-accent/40 bg-accent/10 px-2 py-1 text-[11px]"
                          disabled={busy}
                          onClick={() => ingestMutation.mutate(source.code)}
                        >
                          Ejecutar
                        </button>
                      </div>
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-text-secondary sm:grid-cols-4">
                      <div>
                        <dt className="text-text-tertiary">Última OK</dt>
                        <dd>{formatRelative(source.last_successful_ingestion_at)}</dd>
                      </div>
                      <div>
                        <dt className="text-text-tertiary">Fallos seguidos</dt>
                        <dd>{source.consecutive_failure_count}</dd>
                      </div>
                      <div>
                        <dt className="text-text-tertiary">Última corrida</dt>
                        <dd>
                          {latest
                            ? `${latest.message ?? latest.result_code} · ${latest.documents_new} nuevos`
                            : 'Sin corridas'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-text-tertiary">HTTP evitadas</dt>
                        <dd>{latest?.http_requests_avoided ?? '—'}</dd>
                      </div>
                    </dl>
                  </div>
                )
              })}
            </div>
          </div>
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
                    <th className="py-2 pr-2">Fuente</th>
                    <th className="py-2 pr-2">Resultado</th>
                    <th className="py-2 pr-2">Nuevos</th>
                    <th className="py-2 pr-2">Actualizados</th>
                    <th className="py-2 pr-2">Sin cambios</th>
                    <th className="py-2 pr-2">HTTP evitadas</th>
                  </tr>
                </thead>
                <tbody className="text-text-secondary">
                  {(runsQuery.data ?? []).map((run) => (
                    <tr key={run.id} className="border-b border-border-subtle/60">
                      <td className="py-2 pr-2">{formatDateTime(run.finished_at ?? run.started_at)}</td>
                      <td className="py-2 pr-2">{run.source_name}</td>
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
