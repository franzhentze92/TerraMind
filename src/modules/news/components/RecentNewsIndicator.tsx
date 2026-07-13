import { Link } from 'react-router-dom'
import { useNewsSummary } from '@/modules/news/hooks/useNews'

export function RecentNewsIndicator() {
  const { data } = useNewsSummary(168)
  if (!data || data.documents_captured === 0) return null

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-2/30 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">Noticias recientes</p>
          <p className="mt-1 text-sm text-text-secondary">
            {data.documents_captured} capturada{data.documents_captured === 1 ? '' : 's'} en el periodo · última
            ingesta {data.last_ingestion_at ? new Date(data.last_ingestion_at).toLocaleString('es-GT') : 'sin registro'}
          </p>
        </div>
        <Link to="/noticias" className="text-sm text-sky-300 hover:underline">
          Ver noticias en vivo
        </Link>
      </div>
    </div>
  )
}
