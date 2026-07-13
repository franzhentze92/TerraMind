import { ExternalLink, FileSearch, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { GEOGRAPHIC_STATUS_BADGE } from '../presentation/news-labels'
import type { NewsDocumentListItemDto } from '../types/news-dto.types'

function formatDate(iso: string | null): string {
  if (!iso) return 'Sin fecha'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Sin fecha'
  return d.toLocaleString('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function NewsDocumentCard({ document }: { document: NewsDocumentListItemDto }) {
  const badgeClass = GEOGRAPHIC_STATUS_BADGE[document.geographic_status]

  return (
    <article className="rounded-lg border border-border-subtle bg-surface-2/40 px-3.5 py-2.5 transition-colors hover:border-accent/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            to={`/noticias/${document.id}`}
            className="line-clamp-2 text-sm font-medium text-text-primary hover:text-accent"
          >
            {document.title}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-tertiary">
            <span className="text-text-secondary">{document.source_name}</span>
            <span>·</span>
            <span>{formatDate(document.published_at)}</span>
            {document.preliminary_category_label && (
              <>
                <span>·</span>
                <span>{document.preliminary_category_label}</span>
              </>
            )}
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${badgeClass}`}
          title={document.location_display}
        >
          <MapPin size={10} />
          {document.geographic_status_label}
        </span>
      </div>

      {document.permitted_excerpt && (
        <p className="mt-1.5 line-clamp-2 text-xs text-text-secondary">{document.permitted_excerpt}</p>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-text-tertiary">{document.location_display}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          <a
            href={document.canonical_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-border-subtle px-2 py-0.5 text-[11px] text-text-primary hover:border-accent/40"
          >
            <ExternalLink size={12} />
            Abrir noticia original
          </a>
          <Link
            to={`/noticias/${document.id}`}
            className="inline-flex items-center gap-1 rounded-md border border-border-subtle px-2 py-0.5 text-[11px] text-text-primary hover:border-accent/40"
          >
            <FileSearch size={12} />
            Ver análisis documental
          </Link>
        </div>
      </div>
    </article>
  )
}
