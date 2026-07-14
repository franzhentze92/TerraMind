/**
 * Contenido permitido para análisis IA — solo campos ya almacenados en N1.
 */
import { createHash } from 'node:crypto'
import type { NewsDocumentRow } from '@/pipeline/stores/news.store.js'

export interface PermittedDocumentContent {
  documentId: string
  title: string
  subtitle: string | null
  description: string | null
  permittedExcerpt: string | null
  sourceCategory: string | null
  sourceTags: string[]
  authorNames: string[]
  publishedAt: string | null
  canonicalUrl: string
  sourceName: string
  preliminaryLocation: Record<string, unknown> | null
  geographicStatus: string
  jsonLd: unknown[]
  openGraph: Record<string, unknown>
}

export function buildPermittedDocumentContent(
  doc: NewsDocumentRow,
  sourceName: string,
): PermittedDocumentContent {
  const raw = doc.raw_metadata && typeof doc.raw_metadata === 'object'
    ? (doc.raw_metadata as Record<string, unknown>)
    : {}
  const structured = doc.structured_data && typeof doc.structured_data === 'object'
    ? (doc.structured_data as Record<string, unknown>)
    : {}

  return {
    documentId: doc.id,
    title: doc.title,
    subtitle: doc.subtitle,
    description: doc.description,
    permittedExcerpt: doc.permitted_excerpt,
    sourceCategory: doc.source_category,
    sourceTags: Array.isArray(doc.source_tags) ? doc.source_tags.map(String) : [],
    authorNames: Array.isArray(doc.author_names) ? doc.author_names.map(String) : [],
    publishedAt: doc.published_at,
    canonicalUrl: doc.canonical_url,
    sourceName,
    preliminaryLocation:
      doc.primary_location && typeof doc.primary_location === 'object'
        ? (doc.primary_location as Record<string, unknown>)
        : null,
    geographicStatus: doc.geographic_status,
    jsonLd: Array.isArray(structured.jsonLd) ? structured.jsonLd : [],
    openGraph:
      raw.openGraph && typeof raw.openGraph === 'object'
        ? (raw.openGraph as Record<string, unknown>)
        : {},
  }
}

export function hashPermittedContent(content: PermittedDocumentContent): string {
  return createHash('sha256').update(JSON.stringify(content)).digest('hex')
}

/** Corpus de texto buscable para validación de evidencia. */
export function buildEvidenceCorpus(content: PermittedDocumentContent): Record<string, string> {
  const jsonLdText = content.jsonLd.map((item) => JSON.stringify(item)).join('\n')
  const openGraphText = Object.entries(content.openGraph)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join('\n')

  return {
    title: content.title,
    subtitle: content.subtitle ?? '',
    description: content.description ?? '',
    permitted_excerpt: content.permittedExcerpt ?? '',
    source_category: content.sourceCategory ?? '',
    source_tags: content.sourceTags.join(' '),
    json_ld: jsonLdText,
    open_graph: openGraphText,
    // Alias frecuentes que el modelo puede usar (español / claves internas).
    titulo: content.title,
    subtitulo: content.subtitle ?? '',
    descripcion: content.description ?? '',
    extracto_permitido: content.permittedExcerpt ?? '',
    fecha_publicacion: content.publishedAt ?? '',
    ubicacion_preliminar: content.preliminaryLocation
      ? JSON.stringify(content.preliminaryLocation)
      : '',
  }
}

export function normalizeForEvidenceMatch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function matchesText(normalizedExcerpt: string, fieldText: string): boolean {
  // El modelo a veces agrega elipsis ("..."); se eliminan para no invalidar evidencia válida.
  const cleanedExcerpt = normalizedExcerpt.replace(/\.{2,}|…/g, ' ').replace(/\s+/g, ' ').trim()
  const normalizedField = normalizeForEvidenceMatch(fieldText)
  if (!normalizedField || !cleanedExcerpt) return false
  if (normalizedField.includes(cleanedExcerpt)) return true

  // Coincidencia parcial para fragmentos largos (≥70 % de palabras presentes).
  const words = cleanedExcerpt.split(' ').filter((w) => w.length > 2)
  if (words.length < 3) return normalizedField.includes(cleanedExcerpt)

  const matched = words.filter((w) => normalizedField.includes(w)).length
  return matched / words.length >= 0.7
}

export function excerptExistsInCorpus(
  field: string,
  excerpt: string,
  corpus: Record<string, string>,
): boolean {
  const normalizedExcerpt = normalizeForEvidenceMatch(excerpt)
  if (!normalizedExcerpt || normalizedExcerpt.length < 4) return false

  // 1) Coincidencia en el campo declarado por el modelo.
  const fieldText = corpus[field]
  if (fieldText && matchesText(normalizedExcerpt, fieldText)) return true

  // 2) El modelo puede declarar un campo fuera del catálogo permitido
  //    (p. ej. "url", "categoria"). Se busca el fragmento en todo el corpus
  //    permitido: la garantía anti-invención se mantiene.
  for (const value of Object.values(corpus)) {
    if (matchesText(normalizedExcerpt, value)) return true
  }

  return false
}

export function sanitizeDocumentInputForLlm(content: PermittedDocumentContent): string {
  const payload = {
    titulo: content.title,
    subtitulo: content.subtitle,
    descripcion: content.description,
    extracto_permitido: content.permittedExcerpt,
    categoria: content.sourceCategory,
    etiquetas: content.sourceTags,
    autores: content.authorNames,
    fecha_publicacion: content.publishedAt,
    ubicacion_preliminar: content.preliminaryLocation,
    estado_geografico: content.geographicStatus,
    json_ld: content.jsonLd,
    open_graph: content.openGraph,
    url: content.canonicalUrl,
    medio: content.sourceName,
  }
  return JSON.stringify(payload, null, 2)
}
