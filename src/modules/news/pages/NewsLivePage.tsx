import { useMemo, useState } from 'react'
import { List, Map as MapIcon, X } from 'lucide-react'
import { useHasPermission } from '@/core/auth/AuthProvider'
import { NewsDocumentCard } from '../components/NewsDocumentCard'
import { NewsDocumentsMap } from '../components/NewsDocumentsMap'
import { NewsIngestionControl } from '../components/NewsIngestionControl'
import { SelectedNewsPanel } from '../components/SelectedNewsPanel'
import {
  GEOGRAPHIC_STATUS_BADGE,
  GEOGRAPHIC_STATUS_LABELS,
  PRELIMINARY_CATEGORY_LABELS,
} from '../presentation/news-labels'
import { useNewsDocuments, useNewsSources, useNewsSummary } from '../hooks/useNews'
import type { NewsDocumentListItemDto } from '../types/news-dto.types'
import type { NewsGeographicStatus } from '../types/news.types'

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'Sin registro'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Sin registro'
  return d.toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' })
}

const PERIOD_OPTIONS: Array<{ value: string; label: string; hours: number | null }> = [
  { value: '24', label: 'Últimas 24 h', hours: 24 },
  { value: '72', label: 'Últimas 72 h', hours: 72 },
  { value: '168', label: 'Últimos 7 días', hours: 168 },
  { value: '720', label: 'Últimos 30 días', hours: 720 },
  { value: 'all', label: 'Todo', hours: null },
]

const DISTRIBUTION_ORDER: NewsGeographicStatus[] = [
  'localizada',
  'ubicacion_aproximada',
  'varias_ubicaciones',
  'nacional',
  'internacional',
  'sin_ubicacion',
]

interface Filters {
  source_id: string
  category: string
  geographic_status: string
  period: string
  search: string
}

const EMPTY_FILTERS: Filters = {
  source_id: '',
  category: '',
  geographic_status: '',
  period: '168',
  search: '',
}

export function NewsLivePage() {
  const canIngest = useHasPermission('news.run_ingestion')
  const [view, setView] = useState<'list' | 'map'>('list')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [selected, setSelected] = useState<NewsDocumentListItemDto | null>(null)

  const summaryQuery = useNewsSummary()
  const sourcesQuery = useNewsSources()
  const summary = summaryQuery.data

  const queryFilters = useMemo(() => {
    const period = PERIOD_OPTIONS.find((p) => p.value === filters.period)
    const publishedFrom =
      period?.hours != null ? new Date(Date.now() - period.hours * 3_600_000).toISOString() : undefined
    return {
      source_id: filters.source_id || undefined,
      category: filters.category || undefined,
      geographic_status: filters.geographic_status || undefined,
      published_from: publishedFrom,
      search: filters.search || undefined,
      limit: '100',
    }
  }, [filters])

  const documentsQuery = useNewsDocuments(queryFilters)
  const documents = documentsQuery.data?.items ?? []

  const hasActiveFilters =
    filters.source_id !== '' ||
    filters.category !== '' ||
    filters.geographic_status !== '' ||
    filters.search !== '' ||
    filters.period !== '168'

  const dist = summary?.geographic_distribution

  return (
    <div className="space-y-4" data-testid="news-live-page">
      {/* Encabezado compacto */}
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle pb-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">Noticias en vivo</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            Información pública reciente de Guatemala, organizada para análisis.
          </p>
          <p className="mt-1 text-[11px] text-text-tertiary">
            {summary?.active_sources ?? '—'} fuente
            {summary?.active_sources === 1 ? '' : 's'} activa
            {summary?.active_sources === 1 ? '' : 's'} · Última actualización:{' '}
            {formatDate(summary?.last_ingestion_at)}
          </p>
        </div>
        <NewsIngestionControl
          canIngest={canIngest}
          hasRuns={(summary?.total_ingestion_runs ?? 0) > 0}
          lastIngestionAt={summary?.last_ingestion_at ?? null}
        />
      </header>

      {/* KPIs compactos */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Noticias capturadas', value: summary?.documents_captured ?? '—', tip: undefined },
          { label: 'Fuentes activas', value: summary?.active_sources ?? '—', tip: undefined },
          { label: 'Noticias con ubicación', value: summary?.documents_with_location ?? '—', tip: 'Noticias con ubicación territorial mostrable en el mapa.' },
          {
            label: 'Listas para análisis',
            value: summary?.ready_for_analysis ?? '—',
            tip: 'Noticias con metadatos completos y preparadas para la futura extracción de hechos y señales.',
          },
        ].map((item) => (
          <div
            key={item.label}
            title={item.tip}
            className="rounded-lg border border-border-subtle bg-surface-2/40 px-3 py-2"
          >
            <p className="text-[10px] uppercase tracking-wide text-text-tertiary">{item.label}</p>
            <p className="mt-0.5 text-lg font-semibold text-text-primary">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Distribución territorial */}
      {dist && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-text-tertiary">Distribución:</span>
          {DISTRIBUTION_ORDER.map((status) => (
            <span
              key={status}
              className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${GEOGRAPHIC_STATUS_BADGE[status]}`}
            >
              {GEOGRAPHIC_STATUS_LABELS[status]}
              <span className="font-semibold">{dist[status]}</span>
            </span>
          ))}
        </div>
      )}

      {/* Controles y filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border-subtle p-0.5">
          {(['list', 'map'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs ${
                view === mode ? 'bg-accent/15 text-text-primary' : 'text-text-secondary'
              }`}
            >
              {mode === 'list' ? <List size={13} /> : <MapIcon size={13} />}
              {mode === 'list' ? 'Lista' : 'Mapa'}
            </button>
          ))}
        </div>

        <input
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          placeholder="Buscar por título"
          className="min-w-[180px] flex-1 rounded-lg border border-border-subtle bg-surface-1 px-3 py-1.5 text-xs"
        />

        <select
          value={filters.source_id}
          onChange={(e) => setFilters((f) => ({ ...f, source_id: e.target.value }))}
          className="rounded-lg border border-border-subtle bg-surface-1 px-2 py-1.5 text-xs"
        >
          <option value="">Todas las fuentes</option>
          {(sourcesQuery.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={filters.category}
          onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
          className="rounded-lg border border-border-subtle bg-surface-1 px-2 py-1.5 text-xs"
        >
          <option value="">Todas las categorías</option>
          {Object.entries(PRELIMINARY_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={filters.geographic_status}
          onChange={(e) => setFilters((f) => ({ ...f, geographic_status: e.target.value }))}
          className="rounded-lg border border-border-subtle bg-surface-1 px-2 py-1.5 text-xs"
        >
          <option value="">Toda ubicación</option>
          {Object.entries(GEOGRAPHIC_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={filters.period}
          onChange={(e) => setFilters((f) => ({ ...f, period: e.target.value }))}
          className="rounded-lg border border-border-subtle bg-surface-1 px-2 py-1.5 text-xs"
        >
          {PERIOD_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="inline-flex items-center gap-1 rounded-lg border border-border-subtle px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary"
          >
            <X size={12} /> Limpiar filtros
          </button>
        )}
      </div>

      {/* Contenido */}
      {documentsQuery.isLoading ? (
        <p className="text-sm text-text-secondary">Cargando noticias…</p>
      ) : documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-subtle px-6 py-10 text-center">
          <p className="text-sm text-text-secondary">
            {hasActiveFilters
              ? 'Ninguna noticia coincide con los filtros seleccionados.'
              : 'Todavía no se han capturado noticias de las fuentes habilitadas.'}
          </p>
        </div>
      ) : view === 'list' ? (
        <div className="space-y-2">
          {documents.map((doc) => (
            <NewsDocumentCard key={doc.id} document={doc} />
          ))}
        </div>
      ) : (
        <div className={selected ? 'grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]' : ''}>
          <NewsDocumentsMap
            documents={documents}
            selectedId={selected?.id ?? null}
            onSelect={(doc) => setSelected(doc)}
          />
          {selected && (
            <div className="h-[460px]">
              <SelectedNewsPanel document={selected} onClose={() => setSelected(null)} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
