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
}
