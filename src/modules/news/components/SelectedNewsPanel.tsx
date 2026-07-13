import { ExternalLink, FileSearch, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { GEOGRAPHIC_STATUS_BADGE } from '../presentation/news-labels'
import type { NewsDocumentListItemDto } from '../types/news-dto.types'

function formatDate(iso: string | null): string {
  if (!iso) return 'Sin fecha'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Sin fecha'
  return d.toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' })
}

interface SelectedNewsPanelProps {
  document: NewsDocumentListItemDto
  onClose: () => void
}

export function SelectedNewsPanel({ document, onClose }: SelectedNewsPanelProps) {
  const badgeClass = GEOGRAPHIC_STATUS_BADGE[document.geographic_status]

  return (
    <aside className="flex h-full flex-col rounded-xl border border-border-subtle bg-surface-2/40">
      <div className="flex items-start justify-between gap-2 border-b border-border-subtle px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">Noticia seleccionada</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-text-tertiary hover:bg-surface-1 hover:text-text-primary"
          aria-label="Cerrar panel"
        >
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        <h3 className="text-sm font-semibold text-text-primary">{document.title}</h3>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-text-tertiary">
          <span className="text-text-secondary">{document.source_name}</span>
          <span>·</span>
          <span>{formatDate(document.published_at)}</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {document.preliminary_category_label && (
            <span className="rounded-md border border-border-subtle bg-surface-1 px-1.5 py-0.5 text-[10px] text-text-secondary">
              {document.preliminary_category_label}
            </span>
          )}
          <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${badgeClass}`}>
            {document.geographic_status_label}
          </span>
        </div>

        <dl className="space-y-2 text-xs">
          <div>
            <dt className="text-text-tertiary">Ubicación principal</dt>
            <dd className="text-text-primary">{document.location_display}</dd>
          </div>
          <div>
            <dt className="text-text-tertiary">Nivel de precisión</dt>
            <dd className="text-text-primary">{document.geographic_status_label}</dd>
          </div>
        </dl>

        {document.permitted_excerpt && (
          <div>
            <p className="text-text-tertiary text-xs">Extracto permitido</p>
            <p className="mt-1 text-xs text-text-secondary">{document.permitted_excerpt}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border-subtle px-4 py-3">
        <Link
          to={`/noticias/${document.id}`}
          className="inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs text-text-primary"
        >
          <FileSearch size={13} />
          Ver análisis documental
        </Link>
        <a
          href={document.canonical_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-border-subtle px-2.5 py-1 text-xs text-text-primary hover:border-accent/40"
        >
          <ExternalLink size={13} />
          Abrir noticia original
        </a>
      </div>
    </aside>
  )
}
