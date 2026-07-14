/**
 * Conector Emisoras Unidas (Bloque N1.5-A).
 *
 * Estrategia: news-sitemap oficial (robots.txt).
 * RSS /feed/ existe y está permitido, pero sus <description> incluyen HTML
 * sustancial del artículo; el news-sitemap entrega título + fecha sin cuerpo.
 */
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
import { parseNewsSitemap } from '../../engines/news-sitemap-parser'
import {
  hashDocumentContent,
  normalizeCanonicalUrl,
} from '../../engines/url-normalizer'

export const EMISORAS_UNIDAS_CONNECTOR_VERSION = 'emisoras-unidas.v1'
export const EMISORAS_UNIDAS_SOURCE_CODE = 'emisoras_unidas_gt'

const DEFAULT_NEWS_SITEMAP = 'https://emisorasunidas.com/sitemap/news-sitemap.xml'
const DEFAULT_ALLOWED_DOMAINS = [
  'emisorasunidas.com',
  'www.emisorasunidas.com',
  'img.emisorasunidas.com',
]

/** Prefijos prioritarios para inteligencia agrícola / situación nacional. */
export const EMISORAS_UNIDAS_DEFAULT_INCLUDE_PREFIXES = [
  '/nacional/',
  '/internacionales/',
  '/empresas/',
  '/tecnologia/',
]

/** Exclusión explícita y configurable (deportes, entretenimiento, viral). */
export const EMISORAS_UNIDAS_DEFAULT_EXCLUDE_PREFIXES = [
  '/universo-futbol/',
  '/deportes/',
  '/farandula/',
  '/viral/',
  '/videos/',
]

/** Categorías editoriales reales observadas en el news-sitemap (2026-07). */
export const EMISORAS_UNIDAS_EDITORIAL_CATEGORY_MAP: Record<string, string> = {
  nacional: 'Nacional',
  internacionales: 'Internacional',
  empresas: 'Economía',
  tecnologia: 'Tecnología',
  deportes: 'Deportes',
  'universo-futbol': 'Deportes',
  farandula: 'Entretenimiento',
  viral: 'Viral',
  videos: 'Videos',
}

/** Descripción OG genérica residual del CMS (no usable como extracto). */
const BOILERPLATE_DESCRIPTION_RE =
  /descubre las claves para alcanzar el éxito personal|tu transformación comienza aquí/i

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function withinWindow(iso: string | undefined, windowHours: number): boolean {
  if (!iso) return true
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return true
  return Date.now() - ts <= windowHours * 60 * 60 * 1000
}

function pathSegment(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    return parts[0] ?? null
  } catch {
    return null
  }
}

function matchesAnyPrefix(path: string, prefixes: string[]): boolean {
  return prefixes.some((p) => path.startsWith(p))
}

function usableExcerpt(...candidates: Array<string | null | undefined>): string | null {
  for (const raw of candidates) {
    const text = sanitizeDisplayText(raw)
    if (!text) continue
    if (BOILERPLATE_DESCRIPTION_RE.test(text)) continue
    if (text.length < 28) continue
    return text.slice(0, 600)
  }
  return null
}

export class EmisorasUnidasConnector implements NewsSourceConnector {
  readonly code = EMISORAS_UNIDAS_SOURCE_CODE
  readonly version = EMISORAS_UNIDAS_CONNECTOR_VERSION

  private fetchOpts(source: NewsSource) {
    const cfg = source.connectorConfig
    return {
      allowedDomains: cfg.allowedDomains ?? DEFAULT_ALLOWED_DOMAINS,
      timeoutMs: cfg.requestTimeoutMs ?? 15_000,
      maxRedirects: cfg.maxRedirects ?? 5,
      userAgent: cfg.userAgent,
    }
  }

  private newsSitemapUrl(source: NewsSource): string {
    return (
      source.sitemapUrls.find((u) => u.includes('news-sitemap')) ??
      source.sitemapUrls[0] ??
      DEFAULT_NEWS_SITEMAP
    )
  }

  async inspectSource(source: NewsSource): Promise<SourceInspectionReport> {
    const opts = this.fetchOpts(source)
    const robots = await safeFetchText(source.robotsUrl ?? `${source.baseUrl}/robots.txt`, opts)
    const disallows = parseRobotsDisallows(robots.text)
    const feedDisallowed =
      isPathDisallowedByRobots('/feed/', disallows) ||
      disallows.some((rule) => rule.includes('feed'))

    const sitemapUrlsFound = [
      'https://emisorasunidas.com/sitemap.xml',
      DEFAULT_NEWS_SITEMAP,
      ...(source.sitemapUrls ?? []),
    ]

    let newsSitemapWorks = false
    try {
      const sample = await safeFetchText(this.newsSitemapUrl(source), opts)
      newsSitemapWorks =
        sample.text.includes('<n:news>') || sample.text.includes('<news:news>')
    } catch {
      newsSitemapWorks = false
    }

    const restrictions: string[] = [
      'No republicar texto completo; solo metadatos y extracto permitido',
      'Detener ingesta ante 403, 429 o bloqueo',
      'Disallow robots: /preview/ y SDK Marfeel',
    ]
    if (!feedDisallowed) {
      restrictions.push(
        'RSS /feed/ permitido pero con HTML sustancial en description; no se usa como corpus persistido',
      )
    }

    return {
      sourceCode: source.code,
      canonicalDomain: 'emisorasunidas.com',
      robotsTxt: robots.text.slice(0, 4000),
      robotsAllowsDiscovery: !isPathDisallowedByRobots('/sitemap/news-sitemap.xml', disallows),
      feedUrlsFound: ['https://emisorasunidas.com/feed/'],
      feedUrlsAllowed: !feedDisallowed,
      sitemapUrlsFound: [...new Set(sitemapUrlsFound)],
      jsonLdSupported: true,
      openGraphSupported: true,
      selectedDiscoveryMethod: newsSitemapWorks ? 'news_sitemap' : 'sitemap',
      discoveryJustification: newsSitemapWorks
        ? 'RSS oficial existe en /feed/, pero el news-sitemap declarado en robots.txt ofrece título y fecha sin cuerpo HTML; se selecciona news_sitemap para alinearse a la política de contenido permitido.'
        : 'News-sitemap no respondió; se evaluaría sitemap general con mayor prudencia.',
      accessRestrictions: restrictions,
      rateLimitNotes: ['Pausa conservadora entre solicitudes de artículo (configurable)'],
      termsUrl: String(source.metadata.termsUrl ?? 'https://emisorasunidas.com/'),
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
    const include =
      cfg.categoryPathPrefixes ?? EMISORAS_UNIDAS_DEFAULT_INCLUDE_PREFIXES
    const exclude =
      cfg.excludePathPrefixes ?? EMISORAS_UNIDAS_DEFAULT_EXCLUDE_PREFIXES
    const opts = this.fetchOpts(source)

    const { text } = await safeFetchText(this.newsSitemapUrl(source), opts)
    const all = parseNewsSitemap(text)

    const filtered = all
      .filter((item) => withinWindow(item.publishedAt ?? item.modifiedAt, windowHours))
      .filter((item) => {
        try {
          const path = new URL(item.discoveredUrl).pathname
          if (matchesAnyPrefix(path, exclude)) return false
          return matchesAnyPrefix(path, include)
        } catch {
          return false
        }
      })
      .map((item) => {
        const segment = pathSegment(item.discoveredUrl)
        const sourceCategory = segment
          ? EMISORAS_UNIDAS_EDITORIAL_CATEGORY_MAP[segment] ?? segment
          : undefined
        return {
          ...item,
          sourceCategory,
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
    const keywordExcerpt = item.sourceTags?.[0]
    const excerpt = usableExcerpt(
      parsed.description,
      keywordExcerpt,
      item.title,
    )

    return {
      canonicalUrl: normalizeCanonicalUrl(canonicalUrl),
      discoveredUrl: item.discoveredUrl,
      title: sanitizeDisplayText(parsed.title ?? item.title ?? 'Sin título'),
      authorNames: parsed.authorNames,
      publishedAt: parsed.publishedAt ?? item.publishedAt ?? null,
      modifiedAt: parsed.modifiedAt ?? item.modifiedAt ?? null,
      sourceCategory:
        parsed.sourceCategory ?? item.sourceCategory ?? null,
      sourceTags: [...new Set([...(parsed.sourceTags ?? []), ...(item.sourceTags ?? [])])],
      description: excerpt,
      permittedExcerpt: excerpt,
      imageReferenceUrl: parsed.imageUrl ?? null,
      externalId: parsed.externalId ?? null,
      rawMetadata: {
        openGraph: {
          title: parsed.title,
          description: excerpt,
          image: parsed.imageUrl,
        },
        fetchedAt: new Date().toISOString(),
        finalUrl: url,
        ogDescriptionRejected: Boolean(
          parsed.description && BOILERPLATE_DESCRIPTION_RE.test(parsed.description),
        ),
        publishedAtReason:
          parsed.publishedAt || item.publishedAt
            ? undefined
            : 'Fecha de publicación no disponible en metadata permitida',
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
        attributionLabel: 'Fuente periodística',
        sourceName: source.name,
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

export async function fetchWithRateLimitEu(
  connector: EmisorasUnidasConnector,
  source: NewsSource,
  item: DiscoveredNewsItem,
): Promise<NormalizedNewsDocument> {
  const raw = await connector.fetchDocumentMetadata(source, item)
  await connector.rateLimitPause(source)
  return connector.normalizeDocument(source, item, raw)
}

export { SafeFetchError }
