export interface ParsedHtmlMetadata {
  canonicalUrl?: string
  title?: string
  subtitle?: string
  description?: string
  imageUrl?: string
  publishedAt?: string
  modifiedAt?: string
  authorNames: string[]
  sourceCategory?: string
  sourceTags: string[]
  externalId?: string
  jsonLd: Record<string, unknown>[]
  isOpinion?: boolean
  isLiveCoverage?: boolean
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
}

function matchMeta(html: string, property: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    'i',
  )
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    'i',
  )
  return re.exec(html)?.[1] ?? alt.exec(html)?.[1]
}

function matchLinkCanonical(html: string): string | undefined {
  const re =
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i
  const alt =
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i
  return re.exec(html)?.[1] ?? alt.exec(html)?.[1]
}

function extractJsonLdBlocks(html: string): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = []
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]!.trim()) as unknown
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object') blocks.push(item as Record<string, unknown>)
        }
      } else if (parsed && typeof parsed === 'object') {
        blocks.push(parsed as Record<string, unknown>)
      }
    } catch {
      // ignorar bloques malformados
    }
  }
  return blocks
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function asStringArray(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        if (typeof v === 'string') return v
        if (v && typeof v === 'object' && 'name' in v) return String((v as { name: unknown }).name)
        return null
      })
      .filter((v): v is string => Boolean(v))
  }
  if (value && typeof value === 'object' && 'name' in value) {
    return [String((value as { name: unknown }).name)]
  }
  return []
}

function findNewsArticleJsonLd(blocks: Record<string, unknown>[]): Record<string, unknown> | null {
  for (const block of blocks) {
    const type = block['@type']
    const types = Array.isArray(type) ? type : [type]
    if (types.some((t) => t === 'NewsArticle' || t === 'Article')) return block
  }
  return null
}

export function parseHtmlMetadata(html: string, pageUrl: string): ParsedHtmlMetadata {
  const jsonLd = extractJsonLdBlocks(html)
  const article = findNewsArticleJsonLd(jsonLd)

  const canonicalUrl = matchLinkCanonical(html) ?? asString(article?.mainEntityOfPage)
  const ogTitle = matchMeta(html, 'og:title')
  const title =
    asString(article?.headline) ??
    ogTitle ??
    (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]
      ? stripTags(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)![1]!)
      : undefined)

  const description =
    asString(article?.description) ?? matchMeta(html, 'og:description') ?? matchMeta(html, 'description')

  const imageFromLd = article?.image
  let imageUrl: string | undefined
  if (typeof imageFromLd === 'string') imageUrl = imageFromLd
  else if (imageFromLd && typeof imageFromLd === 'object' && 'url' in imageFromLd) {
    imageUrl = asString((imageFromLd as { url: unknown }).url)
  }
  imageUrl ??= matchMeta(html, 'og:image')

  const publishedAt =
    asString(article?.datePublished) ??
    matchMeta(html, 'article:published_time') ??
    matchMeta(html, 'datePublished')

  const modifiedAt =
    asString(article?.dateModified) ?? matchMeta(html, 'article:modified_time')

  const authorNames = asStringArray(article?.author)
  const sourceCategory = asString(article?.articleSection)
  const keywords = asString(article?.keywords)
  const sourceTags = keywords
    ? keywords.split(',').map((k) => k.trim()).filter(Boolean)
    : []

  const externalId =
    matchMeta(html, 'cXenseParse:articleid') ??
    matchMeta(html, 'cXenseParse:recs:articleid')

  const genres = asString(article?.genre) ?? ''
  const isOpinion = /opinion|columna/i.test(`${sourceCategory ?? ''} ${pageUrl}`)
  const isLiveCoverage = /live|en vivo|minuto a minuto/i.test(`${title ?? ''} ${pageUrl}`)

  return {
    canonicalUrl: canonicalUrl ? new URL(canonicalUrl, pageUrl).toString() : pageUrl,
    title,
    description,
    imageUrl,
    publishedAt,
    modifiedAt,
    authorNames,
    sourceCategory,
    sourceTags,
    externalId,
    jsonLd,
    isOpinion,
    isLiveCoverage: isLiveCoverage || /Blog/i.test(genres),
  }
}

export function sanitizeDisplayText(text: string | null | undefined): string {
  if (!text) return ''
  return stripTags(text).slice(0, 2000)
}
