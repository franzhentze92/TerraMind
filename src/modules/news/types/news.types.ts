/** Tipos de dominio — red documental de noticias (Bloque N1). */

export type NewsSourceType =
  | 'local_press'
  | 'national_press'
  | 'official'
  | 'aggregator'
  | 'international'

export type NewsDiscoveryMethod =
  | 'rss'
  | 'news_sitemap'
  | 'sitemap'
  | 'section_links'
  | 'aggregator'
  | 'html_listing'

export type NewsAccessPolicy =
  | 'metadata_only'
  | 'excerpt_permitted'
  | 'full_text_restricted'
  | 'blocked'

export type NewsContentRetentionPolicy =
  | 'metadata_only'
  | 'excerpt_and_metadata'
  | 'full_text_internal'

export type NewsProcessingStatus =
  | 'discovered'
  | 'metadata_extracted'
  | 'ready_for_analysis'
  | 'restricted'
  | 'failed'
  | 'archived'

export type NewsGeographicStatus =
  | 'localizada'
  | 'ubicacion_aproximada'
  | 'varias_ubicaciones'
  | 'nacional'
  | 'internacional'
  | 'sin_ubicacion'

export type NewsPreliminaryCategory =
  | 'gobierno_politica'
  | 'economia'
  | 'agricultura'
  | 'ambiente'
  | 'salud'
  | 'infraestructura_movilidad'
  | 'seguridad'
  | 'justicia'
  | 'educacion'
  | 'energia'
  | 'sociedad'
  | 'internacional'
  | 'otra'

export type NewsIngestionResultCode = 'pending' | 'success' | 'partial' | 'failed' | 'blocked'

export interface NewsLocationCandidate {
  name: string
  departmentCode?: string
  departmentName?: string
  municipalityCode?: string
  municipalityName?: string
  latitude?: number
  longitude?: number
  confidence: number
  evidence: string
  level: 'exact' | 'approximate' | 'department' | 'national' | 'international'
}

export interface NewsPrimaryLocation {
  name: string
  departmentCode?: string
  departmentName?: string
  municipalityCode?: string
  municipalityName?: string
  latitude?: number
  longitude?: number
  confidence: number
  level: 'exact' | 'approximate' | 'department' | 'national' | 'international'
}

export interface NewsSourceConnectorConfig {
  windowHours?: number
  maxArticles?: number
  rateLimitMs?: number
  requestTimeoutMs?: number
  maxRedirects?: number
  allowedDomains?: string[]
  categoryPathPrefixes?: string[]
  userAgent?: string
  revalidateAfterHours?: number
  liveCoverageRevalidateMinutes?: number
  correctionRevalidateHours?: number
}

export interface NewsSource {
  id: string
  code: string
  name: string
  sourceType: NewsSourceType
  countryCode: string
  primaryLanguage: string
  baseUrl: string
  logoUrl: string | null
  discoveryMethod: NewsDiscoveryMethod
  feedUrls: string[]
  sitemapUrls: string[]
  robotsUrl: string | null
  accessPolicy: NewsAccessPolicy
  contentRetentionPolicy: NewsContentRetentionPolicy
  reliabilityProfile: Record<string, unknown>
  geographicCoverage: Record<string, unknown>
  thematicCoverage: string[]
  isEnabled: boolean
  ingestionFrequencyMinutes: number
  lastSuccessfulIngestionAt: string | null
  lastFailedIngestionAt: string | null
  consecutiveFailureCount: number
  connectorConfig: NewsSourceConnectorConfig
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface NewsDocument {
  id: string
  sourceId: string
  organizationId: string | null
  externalId: string | null
  canonicalUrl: string
  discoveredUrl: string
  title: string
  subtitle: string | null
  authorNames: string[]
  publishedAt: string | null
  modifiedAt: string | null
  capturedAt: string
  sourceCategory: string | null
  sourceTags: string[]
  language: string
  countryCode: string
  description: string | null
  permittedExcerpt: string | null
  imageReferenceUrl: string | null
  rawMetadata: Record<string, unknown>
  structuredData: Record<string, unknown>
  contentHash: string
  canonicalUrlHash: string
  processingStatus: NewsProcessingStatus
  geographicStatus: NewsGeographicStatus
  primaryLocation: NewsPrimaryLocation | null
  locationCandidates: NewsLocationCandidate[]
  isOpinion: boolean
  isSponsored: boolean
  isCorrection: boolean
  isLiveCoverage: boolean
  sourceReliabilitySnapshot: Record<string, unknown>
  preliminaryCategory: NewsPreliminaryCategory | null
  preliminaryCategoryConfidence: number | null
  preliminaryCategoryReasons: string[]
  classifierVersion: string | null
  lastRevalidatedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface NewsIngestionRun {
  id: string
  sourceId: string
  startedAt: string
  finishedAt: string | null
  discoveryMethod: NewsDiscoveryMethod
  urlsDiscovered: number
  documentsNew: number
  documentsUpdated: number
  duplicates: number
  restricted: number
  errors: number
  resultCode: NewsIngestionResultCode
  message: string | null
  checkpoint: Record<string, unknown>
  rateLimitObserved: Record<string, unknown>
  connectorVersion: string
  errorDetails: unknown[]
  revalidated: number
  httpRequestsMade: number
  httpRequestsAvoided: number
  durationMs: number | null
  createdAt: string
}

export interface DiscoveredNewsItem {
  discoveredUrl: string
  title?: string
  publishedAt?: string
  modifiedAt?: string
  sourceCategory?: string
  externalId?: string
}

export interface NormalizedNewsDocument {
  canonicalUrl: string
  discoveredUrl: string
  title: string
  subtitle?: string | null
  authorNames: string[]
  publishedAt?: string | null
  modifiedAt?: string | null
  sourceCategory?: string | null
  sourceTags: string[]
  description?: string | null
  permittedExcerpt?: string | null
  imageReferenceUrl?: string | null
  externalId?: string | null
  rawMetadata: Record<string, unknown>
  structuredData: Record<string, unknown>
  isOpinion?: boolean
  isSponsored?: boolean
  isCorrection?: boolean
  isLiveCoverage?: boolean
}

export interface SourceInspectionReport {
  sourceCode: string
  canonicalDomain: string
  robotsTxt: string
  robotsAllowsDiscovery: boolean
  feedUrlsFound: string[]
  feedUrlsAllowed: boolean
  sitemapUrlsFound: string[]
  jsonLdSupported: boolean
  openGraphSupported: boolean
  selectedDiscoveryMethod: NewsDiscoveryMethod
  discoveryJustification: string
  accessRestrictions: string[]
  rateLimitNotes: string[]
  termsUrl?: string
  inspectedAt: string
}
