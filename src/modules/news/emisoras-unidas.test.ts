import { describe, expect, it } from 'vitest'
import { listRegisteredConnectors, getNewsConnector } from './connectors/registry'
import { parseNewsSitemap } from './engines/news-sitemap-parser'
import { deriveSourceHealth } from './engines/source-health'
import { isUrlOnAllowedDomain, normalizeCanonicalUrl, hashCanonicalUrl } from './engines/url-normalizer'
import { sanitizeDisplayText } from './engines/html-metadata-parser'
import {
  EMISORAS_UNIDAS_DEFAULT_EXCLUDE_PREFIXES,
  EMISORAS_UNIDAS_DEFAULT_INCLUDE_PREFIXES,
  EMISORAS_UNIDAS_EDITORIAL_CATEGORY_MAP,
  EMISORAS_UNIDAS_SOURCE_CODE,
  EmisorasUnidasConnector,
} from './sources/emisoras-unidas/emisoras-unidas.connector'
import { inferPreliminaryGeography } from './engines/preliminary-geolocator'
import {
  geographicStatusLabel,
  preliminaryCategoryLabel,
  processingStatusLabel,
} from './presentation/news-labels'
import type { NewsSource } from './types/news.types'

const EU_SITEMAP_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:n="http://www.google.com/schemas/sitemap-news/0.9">
  <url>
    <loc>https://emisorasunidas.com/nacional/2026/07/14/onda-del-este-lluvias-insivumeh-guatemala/</loc>
    <n:news>
      <n:publication_date>2026-07-14T08:00:00+00:00</n:publication_date>
      <n:title><![CDATA[Onda del este traerá lluvias a Guatemala]]></n:title>
      <n:keywords><![CDATA[lluvias, INSIVUMEH, Guatemala]]></n:keywords>
    </n:news>
  </url>
  <url>
    <loc>https://emisorasunidas.com/universo-futbol/2026/07/14/partido-ejemplo/</loc>
    <n:news>
      <n:publication_date>2026-07-14T09:00:00+00:00</n:publication_date>
      <n:title><![CDATA[Partido de fútbol]]></n:title>
    </n:news>
  </url>
  <url>
    <loc>https://emisorasunidas.com/internacionales/2026/07/14/reunion-onu-centroamerica/</loc>
    <n:news>
      <n:publication_date>2026-07-14T07:30:00+00:00</n:publication_date>
      <n:title><![CDATA[Reunión en la ONU sobre Centroamérica]]></n:title>
    </n:news>
  </url>
</urlset>`

function fakeSource(overrides: Partial<NewsSource> = {}): NewsSource {
  return {
    id: '00000000-0000-4000-8000-000000000099',
    code: EMISORAS_UNIDAS_SOURCE_CODE,
    name: 'Emisoras Unidas',
    sourceType: 'national_press',
    countryCode: 'GT',
    primaryLanguage: 'es',
    baseUrl: 'https://emisorasunidas.com',
    logoUrl: null,
    discoveryMethod: 'news_sitemap',
    feedUrls: ['https://emisorasunidas.com/feed/'],
    sitemapUrls: ['https://emisorasunidas.com/sitemap/news-sitemap.xml'],
    robotsUrl: 'https://emisorasunidas.com/robots.txt',
    accessPolicy: 'metadata_only',
    contentRetentionPolicy: 'excerpt_and_metadata',
    reliabilityProfile: { attribution: 'Fuente periodística' },
    geographicCoverage: { country: 'GT' },
    thematicCoverage: ['nacional'],
    isEnabled: true,
    ingestionFrequencyMinutes: 60,
    lastSuccessfulIngestionAt: null,
    lastFailedIngestionAt: null,
    consecutiveFailureCount: 0,
    connectorConfig: {
      windowHours: 72,
      maxArticles: 30,
      rateLimitMs: 10,
      allowedDomains: ['emisorasunidas.com', 'www.emisorasunidas.com'],
      categoryPathPrefixes: EMISORAS_UNIDAS_DEFAULT_INCLUDE_PREFIXES,
      excludePathPrefixes: EMISORAS_UNIDAS_DEFAULT_EXCLUDE_PREFIXES,
      userAgent: 'TerraMind-NewsBot/1.0-test',
    },
    metadata: { attributionLabel: 'Fuente periodística' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('multi-source registry', () => {
  it('registra Prensa Libre y Emisoras Unidas', () => {
    const codes = listRegisteredConnectors()
    expect(codes).toContain('prensa_libre_gt')
    expect(codes).toContain('emisoras_unidas_gt')
    expect(getNewsConnector('emisoras_unidas_gt').code).toBe('emisoras_unidas_gt')
  })
})

describe('emisoras unidas sitemap parsing', () => {
  it('soporta namespace n: y CDATA', () => {
    const items = parseNewsSitemap(EU_SITEMAP_SAMPLE)
    expect(items).toHaveLength(3)
    expect(items[0]?.title).toContain('lluvias')
    expect(items[0]?.sourceTags?.[0]).toMatch(/lluvias/i)
  })

  it('filtra exclusiones configurables y mapea categorías', () => {
    const connector = new EmisorasUnidasConnector()
    const items = parseNewsSitemap(EU_SITEMAP_SAMPLE)
    const include = EMISORAS_UNIDAS_DEFAULT_INCLUDE_PREFIXES
    const exclude = EMISORAS_UNIDAS_DEFAULT_EXCLUDE_PREFIXES
    const filtered = items.filter((item) => {
      const path = new URL(item.discoveredUrl).pathname
      if (exclude.some((p) => path.startsWith(p))) return false
      return include.some((p) => path.startsWith(p))
    })
    expect(filtered).toHaveLength(2)
    expect(filtered.every((i) => !i.discoveredUrl.includes('universo-futbol'))).toBe(true)
    expect(EMISORAS_UNIDAS_EDITORIAL_CATEGORY_MAP.nacional).toBe('Nacional')
    expect(connector.code).toBe(EMISORAS_UNIDAS_SOURCE_CODE)
  })

  it('normaliza canonical y deduplica por hash de URL', () => {
    const a = normalizeCanonicalUrl(
      'https://emisorasunidas.com/nacional/2026/07/14/onda-del-este-lluvias-insivumeh-guatemala/?utm_source=x',
    )
    const b = normalizeCanonicalUrl(
      'https://emisorasunidas.com/nacional/2026/07/14/onda-del-este-lluvias-insivumeh-guatemala/',
    )
    expect(a).toBe(b)
    expect(hashCanonicalUrl(a)).toBe(hashCanonicalUrl(b))
  })

  it('no fusiona con Prensa Libre aunque el título sea similar', () => {
    const pl = hashCanonicalUrl(
      'https://www.prensalibre.com/guatemala/comunitario/temporada-de-lluvias/',
    )
    const eu = hashCanonicalUrl(
      'https://emisorasunidas.com/nacional/2026/07/14/onda-del-este-lluvias-insivumeh-guatemala/',
    )
    expect(pl).not.toBe(eu)
  })
})

describe('emisoras unidas security', () => {
  it('restringe dominios permitidos', () => {
    expect(
      isUrlOnAllowedDomain('https://emisorasunidas.com/nacional/a/', ['emisorasunidas.com']),
    ).toBe(true)
    expect(
      isUrlOnAllowedDomain('https://evil.example/nacional/a/', ['emisorasunidas.com']),
    ).toBe(false)
    expect(
      isUrlOnAllowedDomain('http://127.0.0.1/admin', ['emisorasunidas.com']),
    ).toBe(false)
  })

  it('sanitiza HTML inesperado', () => {
    expect(sanitizeDisplayText('<script>alert(1)</script>Lluvias en Alta Verapaz')).toBe(
      'alert(1) Lluvias en Alta Verapaz',
    )
  })
})

describe('emisoras unidas normalize + attribution', () => {
  it('estampa procedencia Fuente periodística', () => {
    const connector = new EmisorasUnidasConnector()
    const source = fakeSource()
    const item = {
      discoveredUrl:
        'https://emisorasunidas.com/nacional/2026/07/14/onda-del-este-lluvias-insivumeh-guatemala/',
      title: 'Onda del este',
      publishedAt: '2026-07-14T08:00:00+00:00',
      sourceCategory: 'Nacional',
    }
    const normalized = connector.normalizeDocument(source, item, {
      canonicalUrl: item.discoveredUrl,
      discoveredUrl: item.discoveredUrl,
      title: item.title,
      authorNames: ['Redacción'],
      publishedAt: item.publishedAt,
      modifiedAt: null,
      sourceCategory: 'Nacional',
      sourceTags: ['lluvias'],
      description: 'INSIVUMEH anticipa lluvias',
      permittedExcerpt: 'INSIVUMEH anticipa lluvias',
      imageReferenceUrl: null,
      externalId: null,
      rawMetadata: {},
      structuredData: {},
    })
    expect(normalized.rawMetadata.attributionLabel).toBe('Fuente periodística')
    expect(normalized.rawMetadata.sourceName).toBe('Emisoras Unidas')
    expect(normalized.publishedAt).toBe(item.publishedAt)
  })

  it('provisionalCanonicalUrl permite revalidación incremental', () => {
    const connector = new EmisorasUnidasConnector()
    const url = connector.provisionalCanonicalUrl({
      discoveredUrl:
        'https://emisorasunidas.com/nacional/2026/07/14/pnc-operativos-seguridad-pago-bono-14/?utm_source=x&utm_medium=feed',
    })
    expect(url).not.toContain('utm_source')
    expect(url).not.toContain('utm_medium')
  })
})

describe('geografía y textos visibles', () => {
  it('geolocaliza zonas capitalinas y marcas internacionales', () => {
    const local = inferPreliminaryGeography({
      title: 'Motoladrones asaltan a mujer en Escuintla',
    })
    expect(['localizada', 'ubicacion_aproximada', 'nacional']).toContain(local.geographicStatus)

    const intl = inferPreliminaryGeography({
      title: 'Hombre guatemalteco detenido en Estados Unidos por fraude migratorio',
      sourceCategory: 'Internacional',
      urlPath: '/internacionales/2026/07/14/detenido-estados-unidos/',
    })
    expect(intl.geographicStatus).toBe('internacional')
  })

  it('etiquetas de UI en español', () => {
    expect(geographicStatusLabel('localizada')).toMatch(/ocaliz/i)
    expect(preliminaryCategoryLabel('seguridad')).toBeTruthy()
    expect(processingStatusLabel('ready_for_analysis')).toBeTruthy()
    expect(geographicStatusLabel('internacional')).not.toMatch(/international/i)
  })
})

describe('salud por fuente independiente', () => {
  it('un fallo de fuente A no implica degradación de fuente B', () => {
    const a = deriveSourceHealth({
      isEnabled: true,
      discoveryMethod: 'news_sitemap',
      baseUrl: 'https://emisorasunidas.com',
      consecutiveFailureCount: 3,
      lastSuccessfulIngestionAt: null,
      lastFailedIngestionAt: new Date().toISOString(),
      hasConnector: true,
    })
    const b = deriveSourceHealth({
      isEnabled: true,
      discoveryMethod: 'news_sitemap',
      baseUrl: 'https://www.prensalibre.com',
      consecutiveFailureCount: 0,
      lastSuccessfulIngestionAt: new Date().toISOString(),
      lastFailedIngestionAt: null,
      hasConnector: true,
    })
    expect(a.label).toBe('Degradada')
    expect(b.label).toBe('Operativa')
  })

  it('sin noticias nuevas no implica caída', () => {
    const health = deriveSourceHealth({
      isEnabled: true,
      discoveryMethod: 'news_sitemap',
      baseUrl: 'https://emisorasunidas.com',
      consecutiveFailureCount: 0,
      lastSuccessfulIngestionAt: new Date().toISOString(),
      lastFailedIngestionAt: null,
      hoursSinceLastNewDocument: 80,
      hasConnector: true,
    })
    expect(health.label).toBe('Sin actualizaciones')
  })
})

describe('compatibilidad N2 corpus', () => {
  it('buildPermittedContent usa el nombre de fuente inyectado', async () => {
    const { buildPermittedDocumentContent } = await import('./engines/build-permitted-content')
    const content = buildPermittedDocumentContent(
      {
        id: 'd1',
        source_id: 's1',
        organization_id: null,
        external_id: null,
        canonical_url: 'https://emisorasunidas.com/nacional/x/',
        discovered_url: 'https://emisorasunidas.com/nacional/x/',
        title: 'PNC refuerza operativos',
        subtitle: null,
        author_names: ['Nancy Alvarez'],
        published_at: '2026-07-14T09:00:00Z',
        modified_at: null,
        captured_at: '2026-07-14T10:00:00Z',
        source_category: 'Nacional',
        source_tags: ['PNC'],
        language: 'es',
        country_code: 'GT',
        description: 'Operativos por Bono 14',
        permitted_excerpt: 'Operativos por Bono 14',
        image_reference_url: null,
        raw_metadata: { openGraph: { title: 'PNC refuerza operativos' } },
        structured_data: { jsonLd: [{ '@type': 'NewsArticle' }] },
        content_hash: 'abc',
        canonical_url_hash: 'def',
        processing_status: 'ready_for_analysis',
        geographic_status: 'nacional',
        primary_location: null,
        location_candidates: [],
        is_opinion: false,
        is_sponsored: false,
        is_correction: false,
        is_live_coverage: false,
        source_reliability_snapshot: {},
        preliminary_category: 'seguridad',
        preliminary_category_confidence: 0.7,
        preliminary_category_reasons: ['título'],
        classifier_version: 'v1',
        last_revalidated_at: null,
        created_at: '2026-07-14T10:00:00Z',
        updated_at: '2026-07-14T10:00:00Z',
      },
      'Emisoras Unidas',
    )
    expect(content.sourceName).toBe('Emisoras Unidas')
    expect(content.title).toContain('PNC')
  })
})
