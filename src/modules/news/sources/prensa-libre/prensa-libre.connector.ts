import type {
  DiscoveredNewsItem,
  NewsDiscoveryMethod,
  NewsSource,
  NormalizedNewsDocument,
  SourceInspectionReport,
} from '../../types/news.types'
import type { NewsConnectorCheckpoint, NewsSourceConnector } from '../../connectors/news-source-connector'
import {
  isPathDisallowedByRobots,
  parseRobotsDisallows,
  safeFetchText,
  SafeFetchError,
} from '../../engines/safe-http-client'
import { parseHtmlMetadata, sanitizeDisplayText } from '../../engines/html-metadata-parser'
import {
  hashDocumentContent,
  normalizeCanonicalUrl,
} from '../../engines/url-normalizer'

export const PRENSA_LIBRE_CONNECTOR_VERSION = 'prensa-libre.v1'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseNewsSitemap(xml: string): DiscoveredNewsItem[] {
  const items: DiscoveredNewsItem[] = []
  const urlBlocks = xml.split(/<url>/i).slice(1)
  for (const block of urlBlocks) {
    const loc = /<loc>([^<]+)<\/loc>/i.exec(block)?.[1]?.trim()
    if (!loc) continue
    const title = /<news:title>([^<]*)<\/news:title>/i.exec(block)?.[1]?.trim()
    const publishedAt = /<news:publication_date>([^<]+)<\/news:publication_date>/i.exec(block)?.[1]?.trim()
    const modifiedAt = /<lastmod>([^<]+)<\/lastmod>/i.exec(block)?.[1]?.trim()
    items.push({
      discoveredUrl: loc,
      title: title ? sanitizeDisplayText(title) : undefined,
      publishedAt,
      modifiedAt,
    })
  }
  return items
}

function withinWindow(iso: string | undefined, windowHours: number): boolean {
  if (!iso) return true
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return true
  return Date.now() - ts <= windowHours * 60 * 60 * 1000
}

export class PrensaLibreConnector implements NewsSourceConnector {
  readonly code = 'prensa_libre_gt'
  readonly version = PRENSA_LIBRE_CONNECTOR_VERSION

  private fetchOpts(source: NewsSource) {
    const cfg = source.connectorConfig
    return {
      allowedDomains: cfg.allowedDomains ?? ['www.prensalibre.com', 'prensalibre.com'],
      timeoutMs: cfg.requestTimeoutMs ?? 15_000,
      maxRedirects: cfg.maxRedirects ?? 5,
      userAgent: cfg.userAgent,
    }
  }

  async inspectSource(source: NewsSource): Promise<SourceInspectionReport> {
    const opts = this.fetchOpts(source)
    const robots = await safeFetchText(source.robotsUrl ?? `${source.baseUrl}/robots.txt`, opts)
    const disallows = parseRobotsDisallows(robots.text)
    const feedDisallowed =
      isPathDisallowedByRobots('/feed/', disallows) ||
      disallows.some((rule) => rule.includes('feed'))

    const sitemapUrlsFound = [
      'https://www.prensalibre.com/sitemap.xml',
      'https://www.prensalibre.com/news-sitemap.xml',
    ]

    let newsSitemapWorks = false
    try {
      const sample = await safeFetchText('https://www.prensalibre.com/news-sitemap.xml', opts)
      newsSitemapWorks = sample.text.includes('<news:news>')
    } catch {
      newsSitemapWorks = false
    }

    const restrictions: string[] = []
    if (feedDisallowed) restrictions.push('robots.txt desaconseja /feed/ para User-agent: *')
    restrictions.push('No republicar texto completo; conservar metadatos y extracto OG permitido')
    restrictions.push('Detener ingesta ante 403, 429 o bloqueo')

    return {
      sourceCode: source.code,
      canonicalDomain: 'www.prensalibre.com',
      robotsTxt: robots.text.slice(0, 4000),
      robotsAllowsDiscovery: !isPathDisallowedByRobots('/news-sitemap.xml', disallows),
      feedUrlsFound: ['https://www.prensalibre.com/feed/'],
      feedUrlsAllowed: !feedDisallowed,
      sitemapUrlsFound,
      jsonLdSupported: true,
      openGraphSupported: true,
      selectedDiscoveryMethod: newsSitemapWorks ? 'news_sitemap' : 'sitemap',
      discoveryJustification: feedDisallowed
        ? 'RSS existe pero robots.txt restringe /feed/; se usa news-sitemap.xml declarado en robots.'
        : 'Se usa news-sitemap.xml por cobertura reciente y metadatos editoriales.',
      accessRestrictions: restrictions,
      rateLimitNotes: ['Pausa conservadora entre solicitudes de artículo (configurable)'],
      termsUrl: String(source.metadata.termsUrl ?? 'https://www.prensalibre.com/terminos-y-condiciones/'),
      inspectedAt: new Date().toISOString(),
    }
  }

  async discoverDocuments(
    source: NewsSource,
    _checkpoint?: NewsConnectorCheckpoint,
  ): Promise<DiscoveredNewsItem[]> {
    const cfg = source.connectorConfig
    const windowHours = cfg.windowHours ?? 72
    const maxArticles = cfg.maxArticles ?? 30
    const prefixes = cfg.categoryPathPrefixes ?? ['/guatemala/']
    const opts = this.fetchOpts(source)

    const sitemapUrl = 'https://www.prensalibre.com/news-sitemap.xml'
    const { text } = await safeFetchText(sitemapUrl, opts)
    const all = parseNewsSitemap(text)

    const filtered = all
      .filter((item) => withinWindow(item.publishedAt ?? item.modifiedAt, windowHours))
      .filter((item) => {
        try {
          const path = new URL(item.discoveredUrl).pathname
          return prefixes.some((p) => path.startsWith(p))
        } catch {
          return false
        }
      })
      .slice(0, maxArticles)

    return filtered
  }

  async fetchDocumentMetadata(
    source: NewsSource,
    item: DiscoveredNewsItem,
  ): Promise<NormalizedNewsDocument> {
    const opts = this.fetchOpts(source)
    const { text, url } = await safeFetchText(item.discoveredUrl, opts)
    const parsed = parseHtmlMetadata(text, url)
    const canonicalUrl = parsed.canonicalUrl ?? item.discoveredUrl

    return {
      canonicalUrl: normalizeCanonicalUrl(canonicalUrl),
      discoveredUrl: item.discoveredUrl,
      title: sanitizeDisplayText(parsed.title ?? item.title ?? 'Sin título'),
      authorNames: parsed.authorNames,
      publishedAt: parsed.publishedAt ?? item.publishedAt ?? null,
      modifiedAt: parsed.modifiedAt ?? item.modifiedAt ?? null,
      sourceCategory: parsed.sourceCategory ?? item.sourceCategory ?? null,
      sourceTags: parsed.sourceTags,
      description: sanitizeDisplayText(parsed.description ?? null),
      permittedExcerpt: sanitizeDisplayText(parsed.description ?? null),
      imageReferenceUrl: parsed.imageUrl ?? null,
      externalId: parsed.externalId ?? null,
      rawMetadata: {
        openGraph: {
          title: parsed.title,
          description: parsed.description,
          image: parsed.imageUrl,
        },
        fetchedAt: new Date().toISOString(),
        finalUrl: url,
      },
      structuredData: {
        jsonLd: parsed.jsonLd,
      },
      isOpinion: parsed.isOpinion ?? false,
      isLiveCoverage: parsed.isLiveCoverage ?? false,
    }
  }

  normalizeDocument(
    source: NewsSource,
    item: DiscoveredNewsItem,
    metadata: NormalizedNewsDocument,
  ): NormalizedNewsDocument {
    const title = metadata.title || item.title || 'Sin título'
    return {
      ...metadata,
      title: sanitizeDisplayText(title),
      canonicalUrl: normalizeCanonicalUrl(metadata.canonicalUrl),
      discoveredUrl: item.discoveredUrl,
      permittedExcerpt:
        source.contentRetentionPolicy === 'metadata_only'
          ? null
          : metadata.permittedExcerpt ?? metadata.description ?? null,
      rawMetadata: {
        ...metadata.rawMetadata,
        sourceCode: source.code,
        discoveryMethod: 'news_sitemap' satisfies NewsDiscoveryMethod,
      },
    }
  }

  determineAccessPolicy(source: NewsSource) {
    return {
      accessPolicy: source.accessPolicy,
      contentRetentionPolicy: source.contentRetentionPolicy,
    }
  }

  getNextCheckpoint(
    items: DiscoveredNewsItem[],
    previous?: NewsConnectorCheckpoint,
  ): NewsConnectorCheckpoint {
    const latest = items
      .map((i) => i.publishedAt)
      .filter(Boolean)
      .sort()
      .at(-1)
    return {
      ...previous,
      lastPublishedAt: latest ?? previous?.lastPublishedAt,
      lastCanonicalUrl: items[0]?.discoveredUrl ?? previous?.lastCanonicalUrl,
      inspectedAt: new Date().toISOString(),
    }
  }

  async rateLimitPause(source: NewsSource): Promise<void> {
    await sleep(source.connectorConfig.rateLimitMs ?? 1500)
  }

  /** Hash canónico provisional a partir de la URL del sitemap (sin fetch). */
  provisionalCanonicalUrl(item: DiscoveredNewsItem): string {
    return normalizeCanonicalUrl(item.discoveredUrl)
  }

  contentHash(doc: NormalizedNewsDocument): string {
    return hashDocumentContent([
      doc.title,
      doc.description ?? '',
      doc.modifiedAt ?? '',
      doc.publishedAt ?? '',
      ...(doc.authorNames ?? []),
    ])
  }
}

export async function fetchWithRateLimit(
  connector: PrensaLibreConnector,
  source: NewsSource,
  item: DiscoveredNewsItem,
): Promise<NormalizedNewsDocument> {
  const raw = await connector.fetchDocumentMetadata(source, item)
  await connector.rateLimitPause(source)
  return connector.normalizeDocument(source, item, raw)
}

export { SafeFetchError }
