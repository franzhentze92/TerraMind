import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { GEOGRAPHIC_STATUS_BADGE } from '../presentation/news-labels'
import { NewsDocumentAnalysisSection } from '../components/NewsDocumentAnalysisSection'
import { useNewsDocumentDetail } from '../hooks/useNews'
import type { NewsGeographicStatus } from '../types/news.types'

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'Sin fecha'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Sin fecha'
  return d.toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' })
}

const DISCOVERY_METHOD_LABELS: Record<string, string> = {
  news_sitemap: 'Sitemap de noticias',
  sitemap: 'Sitemap general',
  rss: 'RSS oficial',
  html: 'Listado HTML',
  aggregator: 'Agregador',
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border-subtle bg-surface-2/40 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">{title}</h2>
      <div className="mt-2 space-y-2 text-sm text-text-secondary">{children}</div>
    </section>
  )
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-text-tertiary">{label}</span>
      <span className="text-sm text-text-primary">{value}</span>
    </div>
  )
}

export function NewsDocumentDetailPage() {
  const { documentId } = useParams()
  const { data: doc, isLoading, error } = useNewsDocumentDetail(documentId)

  if (isLoading) return <p className="text-sm text-text-secondary">Cargando documento…</p>
  if (error || !doc) return <p className="text-sm text-rose-300">No se pudo cargar el documento.</p>

  const badgeClass = GEOGRAPHIC_STATUS_BADGE[doc.geographic_status as NewsGeographicStatus]
  const host = hostname(doc.canonical_url)

  return (
    <div className="space-y-4" data-testid="news-document-detail-page">
      {/* A. Encabezado */}
      <header className="border-b border-border-subtle pb-3">
        <Link to="/noticias" className="text-[11px] text-text-tertiary hover:text-text-secondary">
          ← Volver a noticias en vivo
        </Link>
        <h1 className="mt-1 text-lg font-semibold leading-snug text-text-primary">{doc.title}</h1>
        {doc.subtitle && <p className="mt-1 text-sm text-text-secondary">{doc.subtitle}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-text-secondary">{doc.source_name}</span>
          <span className="text-text-tertiary">· {formatDate(doc.published_at)}</span>
          {doc.preliminary_category_label && (
            <span className="rounded-md border border-border-subtle bg-surface-1 px-1.5 py-0.5 text-text-secondary">
              {doc.preliminary_category_label}
            </span>
          )}
          <span className={`rounded-md border px-1.5 py-0.5 font-medium ${badgeClass}`}>
            {doc.geographic_status_label}
          </span>
          <span className="rounded-md border border-border-subtle bg-surface-1 px-1.5 py-0.5 text-text-secondary">
            {doc.processing_status_label}
          </span>
        </div>
      </header>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* B. Resumen documental */}
        <Section title="Resumen documental">
          {doc.permitted_excerpt ? (
            <p className="text-sm text-text-secondary">{doc.permitted_excerpt}</p>
          ) : (
            <p className="text-sm text-text-tertiary">Sin extracto permitido.</p>
          )}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <Field label="Ubicación principal" value={doc.location_display} />
            <Field label="Nivel de precisión" value={doc.geographic_status_label} />
            <Field
              label="Autor"
              value={doc.author_names.length > 0 ? doc.author_names.join(', ') : 'No indicado'}
            />
            <Field label="Categoría original" value={doc.source_category ?? 'No indicada'} />
          </div>
        </Section>

        {/* C. Análisis del sistema */}
        <Section title="Análisis del sistema">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Clasificación propuesta" value={doc.system_analysis.category_proposed ?? 'Sin clasificar'} />
            <Field
              label="Confianza"
              value={
                doc.system_analysis.category_confidence != null
                  ? `${Math.round(doc.system_analysis.category_confidence * 100)}%`
                  : '—'
              }
            />
            <Field label="Ubicación propuesta" value={doc.system_analysis.location_proposed ?? 'Sin ubicación'} />
            <Field label="Estado geográfico" value={doc.system_analysis.geographic_status_label} />
          </div>
          {doc.system_analysis.category_reasons.length > 0 && (
            <div>
              <p className="text-[11px] text-text-tertiary">Razones de clasificación</p>
              <ul className="mt-1 list-disc pl-4 text-xs">
                {doc.system_analysis.category_reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
          {doc.location_candidates.length > 0 && (
            <div>
              <p className="text-[11px] text-text-tertiary">Ubicaciones candidatas</p>
              <ul className="mt-1 space-y-0.5 text-xs">
                {doc.location_candidates.map((c) => (
                  <li key={`${c.name}-${c.evidence}`} className="text-text-secondary">
                    {c.name}
                    {c.department_name && c.department_name !== c.name ? ` (${c.department_name})` : ''} ·{' '}
                    <span className="text-text-tertiary">“{c.evidence}”</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        {/* D. Procedencia */}
        <Section title="Procedencia">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fuente" value={doc.provenance.source_name} />
            <Field
              label="Método de descubrimiento"
              value={DISCOVERY_METHOD_LABELS[doc.provenance.discovery_method] ?? doc.provenance.discovery_method}
            />
            <Field label="Fecha de captura" value={formatDate(doc.captured_at)} />
            <Field label="Política de acceso" value={doc.access_policy_label} />
          </div>
          <div className="pt-1">
            <p className="text-[11px] text-text-tertiary">Fuente original</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm text-text-primary">{host}</span>
              <a
                href={doc.canonical_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs text-text-primary"
              >
                <ExternalLink size={12} />
                Abrir noticia original
              </a>
            </div>
            <details className="mt-1">
              <summary className="cursor-pointer text-[11px] text-text-tertiary">Ver URL canónica</summary>
              <p className="mt-1 break-all text-[11px] text-text-tertiary">{doc.canonical_url}</p>
            </details>
          </div>
        </Section>

        {/* E. Estado futuro + Historial */}
        <Section title="Estado de procesamiento">
          <p className="text-sm text-text-secondary">{doc.system_analysis.event_grouping_status}</p>
          {doc.update_history.length > 0 && (
            <div className="pt-1">
              <p className="text-[11px] text-text-tertiary">Historial de actualización</p>
              <ul className="mt-1 space-y-0.5 text-xs">
                {doc.update_history.map((h, i) => (
                  <li key={`${h.at}-${i}`} className="text-text-secondary">
                    {formatDate(h.at)} · {h.fields.length > 0 ? h.fields.join(', ') : 'sin cambios de campos'}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      </div>

      {documentId && <NewsDocumentAnalysisSection documentId={documentId} />}
    </div>
  )
}
