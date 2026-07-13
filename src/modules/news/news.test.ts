import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { classifyPreliminaryCategory } from './engines/preliminary-classifier'
import { inferPreliminaryGeography } from './engines/preliminary-geolocator'
import { decideRevalidation } from './engines/revalidation-policy'
import { parseHtmlMetadata, sanitizeDisplayText } from './engines/html-metadata-parser'
import { hashCanonicalUrl, normalizeCanonicalUrl, isUrlOnAllowedDomain } from './engines/url-normalizer'
import { isPathDisallowedByRobots, parseRobotsDisallows } from './engines/safe-http-client'
import {
  geographicStatusLabel,
  preliminaryCategoryLabel,
  processingStatusLabel,
} from './presentation/news-labels'

const SAMPLE_HTML = readFileSync(
  resolve('src/modules/news/fixtures/prensa-libre-article.sample.html'),
  'utf8',
)

describe('news url normalizer', () => {
  it('normaliza URLs y elimina parámetros de seguimiento', () => {
    const url =
      'https://www.prensalibre.com/guatemala/justicia/ejemplo/?utm_source=test#section'
    expect(normalizeCanonicalUrl(url)).toBe(
      'https://www.prensalibre.com/guatemala/justicia/ejemplo',
    )
    expect(hashCanonicalUrl(url)).toHaveLength(64)
  })

  it('valida dominios permitidos', () => {
    expect(
      isUrlOnAllowedDomain('https://www.prensalibre.com/nota', ['www.prensalibre.com']),
    ).toBe(true)
    expect(isUrlOnAllowedDomain('https://evil.example/nota', ['www.prensalibre.com'])).toBe(false)
  })
})

describe('news html metadata parser', () => {
  it('extrae JSON-LD NewsArticle y metadatos OG', () => {
    const parsed = parseHtmlMetadata(
      SAMPLE_HTML,
      'https://www.prensalibre.com/guatemala/justicia/ejemplo/',
    )
    expect(parsed.title).toContain('falta de mérito')
    expect(parsed.authorNames.length).toBeGreaterThan(0)
    expect(parsed.sourceCategory).toBe('Justicia')
    expect(parsed.description).toBeTruthy()
    expect(parsed.jsonLd.length).toBeGreaterThan(0)
  })

  it('sanitiza HTML para visualización', () => {
    expect(sanitizeDisplayText('<b>Hola</b> mundo')).toBe('Hola mundo')
  })
})

describe('news preliminary classifier', () => {
  it('clasifica noticia de justicia', () => {
    const result = classifyPreliminaryCategory({
      title: 'Jueza dicta falta de mérito a piloto',
      sourceCategory: 'Justicia',
      urlPath: '/guatemala/justicia/caso/',
    })
    expect(result.category).toBe('justicia')
    expect(result.confidence).toBeGreaterThan(0.3)
    expect(result.reasons.length).toBeGreaterThan(0)
  })
})

describe('news preliminary geolocator', () => {
  it('detecta zona 15 como punto localizado en la capital', () => {
    const result = inferPreliminaryGeography({
      title: 'Accidente en la zona 15 deja un muerto',
    })
    expect(result.geographicStatus).toBe('localizada')
    expect(result.primaryLocation?.departmentCode).toBe('01')
    expect(result.primaryLocation?.latitude).toBeTypeOf('number')
  })

  it('detecta un municipio concreto (Mixco)', () => {
    const result = inferPreliminaryGeography({
      title: 'Ataque armado deja dos fallecidos en venta de licor en Mixco',
    })
    expect(result.primaryLocation?.departmentCode).toBe('01')
    expect(['localizada', 'ubicacion_aproximada']).toContain(result.geographicStatus)
  })

  it('expone un nombre específico para la zona (no "Guatemala" a secas)', () => {
    const result = inferPreliminaryGeography({
      title: 'Accidente en la zona 15 deja un muerto',
    })
    expect(result.primaryLocation?.name).toBe('Zona 15, Ciudad de Guatemala')
    expect(result.primaryLocation?.municipalityName).toBe('Ciudad de Guatemala')
    expect(result.primaryLocation?.name).not.toBe('Guatemala')
  })

  it('usa el nombre del municipio como ubicación (Villa Nueva)', () => {
    const result = inferPreliminaryGeography({
      title: 'Localizan un cadáver en Villa Nueva',
    })
    expect(result.primaryLocation?.municipalityName).toBe('Villa Nueva')
  })

  it('NO asigna departamento por la palabra "Guatemala" (país)', () => {
    const result = inferPreliminaryGeography({
      title: 'Pronóstico del clima en Guatemala del 13 al 17 de julio',
      description: 'Dónde se esperan lluvias y las temperaturas más altas',
    })
    expect(result.geographicStatus).toBe('nacional')
    expect(result.primaryLocation?.latitude).toBeUndefined()
  })

  it('clasifica noticia nacional explícita como Nacional sin punto', () => {
    const result = inferPreliminaryGeography({
      title: 'Salud confirma más de 27 mil casos de sarampión y 26 decesos a nivel nacional',
    })
    expect(result.geographicStatus).toBe('nacional')
    expect(result.primaryLocation?.level).toBe('national')
    expect(result.primaryLocation?.latitude).toBeUndefined()
  })

  it('clasifica noticia internacional aunque mencione a un guatemalteco', () => {
    const result = inferPreliminaryGeography({
      title: 'Guatemalteco dueño de una panadería, detenido por ICE en Florida',
    })
    expect(result.geographicStatus).toBe('internacional')
    expect(result.primaryLocation?.latitude).toBeUndefined()
  })

  it('no cuenta doble un municipio que contiene el nombre de otro depto.', () => {
    const result = inferPreliminaryGeography({
      title: 'PNC captura a pareja en San Juan Sacatepéquez',
    })
    expect(result.geographicStatus).not.toBe('varias_ubicaciones')
    expect(result.primaryLocation?.departmentCode).toBe('01')
  })

  it('clasifica Internacional un hecho en EE. UU. pese al origen del implicado', () => {
    const result = inferPreliminaryGeography({
      title:
        'Juan José Morales Cifuentes, esposo de la alcaldesa de Ayutla, se declara culpable en EE. UU.',
      description: 'El caso se resolvió ante una corte federal',
      sourceCategory: 'Guatemala',
    })
    expect(result.geographicStatus).toBe('internacional')
  })

  it('devuelve Sin ubicación cuando no hay evidencia territorial', () => {
    const result = inferPreliminaryGeography({
      title: 'Yo cuento: Aporta calidad y experiencia',
      sourceCategory: 'Comunitario',
    })
    expect(result.geographicStatus).toBe('sin_ubicacion')
    expect(result.primaryLocation).toBeNull()
  })

  it('no coloca punto para nacional/internacional/sin ubicación', () => {
    for (const title of [
      'Salud confirma casos a nivel nacional',
      'Detenido por ICE en Florida',
      'Yo cuento: un legado que inspira',
    ]) {
      const result = inferPreliminaryGeography({ title })
      const hasPoint =
        result.primaryLocation?.latitude != null && result.primaryLocation?.longitude != null
      expect(hasPoint).toBe(false)
    }
  })
})

describe('news revalidation policy', () => {
  const cfg = { revalidateAfterHours: 24, liveCoverageRevalidateMinutes: 30, correctionRevalidateHours: 6 }
  const now = Date.parse('2026-07-13T20:00:00Z')

  it('omite fetch cuando el documento está fresco y sin lastmod nuevo', () => {
    const d = decideRevalidation(
      {
        sitemapLastmod: '2026-07-13T10:00:00Z',
        storedModifiedAt: '2026-07-13T10:00:00Z',
        storedPublishedAt: '2026-07-13T09:00:00Z',
        lastCheckedAt: '2026-07-13T19:30:00Z',
        isLiveCoverage: false,
        isCorrection: false,
      },
      cfg,
      now,
    )
    expect(d.fetch).toBe(false)
    expect(d.reason).toBe('fresh')
  })

  it('descarga cuando el sitemap muestra lastmod posterior', () => {
    const d = decideRevalidation(
      {
        sitemapLastmod: '2026-07-13T19:00:00Z',
        storedModifiedAt: '2026-07-13T10:00:00Z',
        storedPublishedAt: '2026-07-13T09:00:00Z',
        lastCheckedAt: '2026-07-13T19:30:00Z',
        isLiveCoverage: false,
        isCorrection: false,
      },
      cfg,
      now,
    )
    expect(d.fetch).toBe(true)
    expect(d.reason).toBe('lastmod_newer')
  })

  it('revalida cobertura en vivo con ventana corta', () => {
    const d = decideRevalidation(
      {
        sitemapLastmod: '2026-07-13T10:00:00Z',
        storedModifiedAt: '2026-07-13T10:00:00Z',
        storedPublishedAt: '2026-07-13T09:00:00Z',
        lastCheckedAt: '2026-07-13T19:00:00Z',
        isLiveCoverage: true,
        isCorrection: false,
      },
      cfg,
      now,
    )
    expect(d.fetch).toBe(true)
    expect(d.reason).toBe('live_window')
  })

  it('respeta la ventana estándar de 24h', () => {
    const d = decideRevalidation(
      {
        sitemapLastmod: '2026-07-10T10:00:00Z',
        storedModifiedAt: '2026-07-10T10:00:00Z',
        storedPublishedAt: '2026-07-10T09:00:00Z',
        lastCheckedAt: '2026-07-11T10:00:00Z',
        isLiveCoverage: false,
        isCorrection: false,
      },
      cfg,
      now,
    )
    expect(d.fetch).toBe(true)
    expect(d.reason).toBe('standard_window')
  })
})

describe('news robots restrictions', () => {
  it('parsea reglas disallow del robots de Prensa Libre', () => {
    const robots = `User-agent: *\nDisallow: /*/feed/\nSitemap: https://www.prensalibre.com/news-sitemap.xml`
    const disallows = parseRobotsDisallows(robots)
    expect(disallows.some((rule) => rule.includes('feed'))).toBe(true)
    expect(isPathDisallowedByRobots('/news-sitemap.xml', disallows)).toBe(false)
  })
})

describe('news visible labels in spanish', () => {
  it('expone etiquetas en español', () => {
    expect(processingStatusLabel('ready_for_analysis')).toBe('Lista para análisis')
    expect(geographicStatusLabel('sin_ubicacion')).toBe('Sin ubicación')
    expect(preliminaryCategoryLabel('gobierno_politica')).toBe('Gobierno y política pública')
  })
})

describe('news deduplication hash stability', () => {
  it('produce el mismo hash para la misma URL canónica', () => {
    const a = hashCanonicalUrl('https://www.prensalibre.com/nota/')
    const b = hashCanonicalUrl('https://www.prensalibre.com/nota')
    expect(a).toBe(b)
  })
})
