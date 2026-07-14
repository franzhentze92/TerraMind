import { Link } from 'react-router-dom'
import { useHasPermission } from '@/core/auth/AuthProvider'
import { useApproveAnalysis, useRejectAnalysis, useReviewQueue } from '../hooks/useNewsAnalysis'

export function NewsReviewTab() {
  const canReview = useHasPermission('news.analysis.review')
  const { data: items = [], isLoading } = useReviewQueue()
  const approve = useApproveAnalysis()
  const reject = useRejectAnalysis()

  if (isLoading) return <p className="text-sm text-text-secondary">Cargando revisión documental…</p>

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-border-subtle bg-surface-2/40 p-4 text-sm text-text-secondary">
        No hay análisis pendientes de revisión.
      </p>
    )
  }

  return (
    <div className="space-y-3" data-testid="news-review-tab">
      <p className="text-xs text-text-tertiary">
        Revisión documental — análisis con baja confianza, contenido sensible o validaciones pendientes.
      </p>
      {items.map((item) => (
        <article
          key={item.id}
          className="rounded-xl border border-border-subtle bg-surface-2/40 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <Link
                to={`/noticias/${item.document_id}`}
                className="text-sm font-medium text-sky-400 hover:text-sky-300"
              >
                {item.document_title ?? 'Sin título'}
              </Link>
              <p className="mt-1 text-[11px] text-text-tertiary">{item.status_label}</p>
              {item.primary_fact_statement && (
                <p className="mt-2 text-sm text-text-secondary">{item.primary_fact_statement}</p>
              )}
            </div>
            {item.relevance_score != null && (
              <span className="text-[11px] text-text-tertiary">
                Relevancia {Math.round(item.relevance_score * 100)}%
              </span>
            )}
          </div>

          {item.review_reasons.length > 0 && (
            <ul className="mt-2 list-disc pl-4 text-xs text-amber-200/90">
              {item.review_reasons.slice(0, 4).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}

          {canReview && (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={approve.isPending}
                onClick={() => approve.mutate({ analysisId: item.id })}
                className="rounded-lg border border-emerald-500/40 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10"
              >
                Aprobar análisis
              </button>
              <button
                type="button"
                disabled={reject.isPending}
                onClick={() => reject.mutate({ analysisId: item.id, reason: 'Rechazado en revisión documental' })}
                className="rounded-lg border border-rose-500/40 px-2.5 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
              >
                Rechazar análisis
              </button>
            </div>
          )}
        </article>
      ))}
    </div>
  )
}
