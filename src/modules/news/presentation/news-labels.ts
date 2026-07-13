import type {
  NewsGeographicStatus,
  NewsPreliminaryCategory,
  NewsProcessingStatus,
} from '../types/news.types'

export const PROCESSING_STATUS_LABELS: Record<NewsProcessingStatus, string> = {
  discovered: 'Descubierta',
  metadata_extracted: 'Metadatos extraídos',
  ready_for_analysis: 'Lista para análisis',
  restricted: 'Contenido restringido',
  failed: 'Error de procesamiento',
  archived: 'Archivada',
}

export const GEOGRAPHIC_STATUS_LABELS: Record<NewsGeographicStatus, string> = {
  localizada: 'Localizada',
  ubicacion_aproximada: 'Ubicación aproximada',
  varias_ubicaciones: 'Varias ubicaciones',
  nacional: 'Nacional',
  internacional: 'Internacional',
  sin_ubicacion: 'Sin ubicación',
}

export const PRELIMINARY_CATEGORY_LABELS: Record<NewsPreliminaryCategory, string> = {
  gobierno_politica: 'Gobierno y política pública',
  economia: 'Economía',
  agricultura: 'Agricultura',
  ambiente: 'Ambiente',
  salud: 'Salud',
  infraestructura_movilidad: 'Infraestructura y movilidad',
  seguridad: 'Seguridad',
  justicia: 'Justicia',
  educacion: 'Educación',
  energia: 'Energía',
  sociedad: 'Sociedad',
  internacional: 'Internacional',
  otra: 'Otra',
}

export const ACCESS_POLICY_LABELS: Record<string, string> = {
  metadata_only: 'Solo metadatos permitidos',
  excerpt_permitted: 'Extracto permitido',
  full_text_restricted: 'Texto completo restringido',
  blocked: 'Acceso bloqueado',
}

export const CONTENT_RETENTION_LABELS: Record<string, string> = {
  metadata_only: 'Conservar solo metadatos',
  excerpt_and_metadata: 'Conservar extracto y metadatos',
  full_text_internal: 'Texto completo solo para uso interno',
}

export function processingStatusLabel(status: NewsProcessingStatus): string {
  return PROCESSING_STATUS_LABELS[status] ?? status
}

export function geographicStatusLabel(status: NewsGeographicStatus): string {
  return GEOGRAPHIC_STATUS_LABELS[status] ?? status
}

export function preliminaryCategoryLabel(
  category: NewsPreliminaryCategory | null | undefined,
): string | null {
  if (!category) return null
  return PRELIMINARY_CATEGORY_LABELS[category] ?? category
}

/** Clases de badge (Tailwind) por estado geográfico, para la UI. */
export const GEOGRAPHIC_STATUS_BADGE: Record<NewsGeographicStatus, string> = {
  localizada: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  ubicacion_aproximada: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300',
  varias_ubicaciones: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  nacional: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
  internacional: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
  sin_ubicacion: 'border-border-subtle bg-surface-2/60 text-text-tertiary',
}
