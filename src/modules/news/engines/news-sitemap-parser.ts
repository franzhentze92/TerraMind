/**
 * Parser compartido de Google News Sitemap (namespaces news: y n:).
 */
import type { DiscoveredNewsItem } from '../types/news.types'
import { sanitizeDisplayText } from './html-metadata-parser'

function unwrapCdata(value: string | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  const cdata = /^<!\[CDATA\[([\s\S]*?)\]\]>$/i.exec(trimmed)
  return (cdata?.[1] ?? trimmed).trim() || undefined
}

function extractTag(block: string, localName: string): string | undefined {
  const re = new RegExp(
    `<(?:news|n):${localName}>([\\s\\S]*?)<\\/(?:news|n):${localName}>`,
    'i',
  )
  return unwrapCdata(re.exec(block)?.[1])
}

/** Extrae candidatos desde un news-sitemap XML. */
export function parseNewsSitemap(xml: string): DiscoveredNewsItem[] {
  const items: DiscoveredNewsItem[] = []
  const urlBlocks = xml.split(/<url>/i).slice(1)
  for (const block of urlBlocks) {
    const loc = /<loc>([^<]+)<\/loc>/i.exec(block)?.[1]?.trim()
    if (!loc) continue
    const title = extractTag(block, 'title')
    const publishedAt = extractTag(block, 'publication_date')
    const keywords = extractTag(block, 'keywords')
    const modifiedAt = unwrapCdata(/<lastmod>([^<]*)<\/lastmod>/i.exec(block)?.[1])
    const tags = keywords
      ? keywords
          .split(',')
          .map((k) => sanitizeDisplayText(k))
          .filter(Boolean)
      : undefined
    items.push({
      discoveredUrl: loc,
      title: title ? sanitizeDisplayText(title) : undefined,
      publishedAt,
      modifiedAt,
      sourceTags: tags,
    })
  }
  return items
}
