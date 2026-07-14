import type {
  DiscoveredNewsItem,
  NewsSource,
  NormalizedNewsDocument,
  SourceInspectionReport,
} from '../types/news.types'

export interface NewsConnectorCheckpoint {
  lastPublishedAt?: string
  lastCanonicalUrl?: string
  inspectedAt?: string
}

export interface NewsSourceConnector {
  readonly code: string
  readonly version: string
  inspectSource(source: NewsSource): Promise<SourceInspectionReport>
  discoverDocuments(
    source: NewsSource,
    checkpoint?: NewsConnectorCheckpoint,
  ): Promise<DiscoveredNewsItem[]>
  fetchDocumentMetadata(
    source: NewsSource,
    item: DiscoveredNewsItem,
  ): Promise<NormalizedNewsDocument>
  normalizeDocument(
    source: NewsSource,
    item: DiscoveredNewsItem,
    metadata: NormalizedNewsDocument,
  ): NormalizedNewsDocument
  determineAccessPolicy(source: NewsSource): {
    accessPolicy: NewsSource['accessPolicy']
    contentRetentionPolicy: NewsSource['contentRetentionPolicy']
  }
  getNextCheckpoint(
    items: DiscoveredNewsItem[],
    previous?: NewsConnectorCheckpoint,
  ): NewsConnectorCheckpoint
  /** URL canónica provisional (sin fetch) para deduplicación. */
  provisionalCanonicalUrl?(item: DiscoveredNewsItem): string
  /** Pausa entre fetches de artículo. */
  rateLimitPause?(source: NewsSource): Promise<void>
}

export function resolveProvisionalCanonicalUrl(
  connector: NewsSourceConnector,
  item: DiscoveredNewsItem,
): string {
  if (typeof connector.provisionalCanonicalUrl === 'function') {
    return connector.provisionalCanonicalUrl(item)
  }
  return item.discoveredUrl
}

export async function fetchNormalizedWithOptionalRateLimit(
  connector: NewsSourceConnector,
  source: NewsSource,
  item: DiscoveredNewsItem,
): Promise<NormalizedNewsDocument> {
  const raw = await connector.fetchDocumentMetadata(source, item)
  if (typeof connector.rateLimitPause === 'function') {
    await connector.rateLimitPause(source)
  }
  return connector.normalizeDocument(source, item, raw)
}
