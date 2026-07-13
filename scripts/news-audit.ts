#!/usr/bin/env tsx
/**
 * news:audit — Bloque N1 gate: Prensa Libre ingestion, geolocation, live news UI.
 */
import { config } from 'dotenv'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { GEOGRAPHIC_STATUS_LABELS, PROCESSING_STATUS_LABELS } from '@/modules/news/presentation/news-labels'
import { MAPPABLE_STATUSES } from '@/modules/news/presentation/news-map-policy'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

config({ path: resolve(process.cwd(), '.env') })

const ROOT = process.cwd()
const failures: string[] = []
const passes: string[] = []

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) passes.push(name)
  else failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
}

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8')
}

const requiredFiles = [
  'src/modules/news/pages/NewsLivePage.tsx',
  'src/modules/news/pages/NewsDocumentDetailPage.tsx',
  'src/modules/news/components/NewsDocumentsMap.tsx',
  'src/modules/news/components/SelectedNewsPanel.tsx',
  'src/modules/news/components/NewsIngestionControl.tsx',
  'src/modules/news/engines/revalidation-policy.ts',
  'src/modules/news/engines/preliminary-geolocator.ts',
  'src/modules/news/sources/prensa-libre/prensa-libre.connector.ts',
  'server/services/news-ingestion.service.ts',
  'server/routes/news.ts',
  'src/pipeline/stores/news.store.ts',
  'supabase/migrations/034_news_intelligence.sql',
  'supabase/migrations/035_news_ingestion_metrics.sql',
  'scripts/news-ingest.ts',
  'src/modules/news/news.test.ts',
]

for (const f of requiredFiles) {
  check(`file:${f}`, existsSync(resolve(ROOT, f)))
}

// Language — no English UI leaks in news pages
const liveSrc = read('src/modules/news/pages/NewsLivePage.tsx')
check('language:listas-para-analisis', liveSrc.includes('Listas para análisis'))
check('language:no-pending-analysis', !liveSrc.includes('Pendientes de análisis'))
check('language:actualizar-noticias', read('src/modules/news/components/NewsIngestionControl.tsx').includes('Actualizar noticias'))

const detailSrc = read('src/modules/news/pages/NewsDocumentDetailPage.tsx')
check('language:ubicacion-principal', detailSrc.includes('Ubicación principal'))
check('language:nivel-precision', detailSrc.includes('Nivel de precisión'))
check('language:no-canonical-url-block', !detailSrc.includes('URL canónica:'))
check('language:abrir-noticia', detailSrc.includes('Abrir noticia original'))

const mapSrc = read('src/modules/news/components/NewsDocumentsMap.tsx')
check('language:map-disclaimer', mapSrc.includes('no hechos confirmados ni amenazas'))
check('map:excludes-national', mapSrc.includes("'nacional'"))
check('map:excludes-internacional', mapSrc.includes("'internacional'"))
check('map:excludes-sin-ubicacion', mapSrc.includes("'sin_ubicacion'"))

const ingestSrc = read('server/services/news-ingestion.service.ts')
check('ingestion:early-skip', ingestSrc.includes('decideRevalidation'))
check('ingestion:http-avoided-metric', ingestSrc.includes('http_requests_avoided'))

async function auditDatabase() {
  const admin = getSupabaseAdmin()

  const { data: source, error: sourceErr } = await admin
    .from('news_sources')
    .select('code, discovery_method, is_enabled')
    .eq('code', 'prensa_libre_gt')
    .maybeSingle()
  if (sourceErr) throw sourceErr
  check('source:prensa-libre-registered', source?.code === 'prensa_libre_gt')
  check('source:discovery-news-sitemap', source?.discovery_method === 'news_sitemap')
  check('source:enabled', source?.is_enabled === true)

  const { count: docCount, error: docErr } = await admin
    .from('news_documents')
    .select('id', { count: 'exact', head: true })
  if (docErr) throw docErr
  check('documents:total-30', docCount === 30, `got ${docCount}`)

  const { count: readyCount } = await admin
    .from('news_documents')
    .select('id', { count: 'exact', head: true })
    .eq('processing_status', 'ready_for_analysis')
  check('documents:ready-for-analysis-30', readyCount === 30, `got ${readyCount}`)

  const { data: statusRows, error: statusErr } = await admin
    .from('news_documents')
    .select('geographic_status')
  if (statusErr) throw statusErr
  const dist: Record<string, number> = {}
  for (const row of statusRows ?? []) {
    const s = String(row.geographic_status)
    dist[s] = (dist[s] ?? 0) + 1
  }
  check('geo:localizada-4', dist.localizada === 4, `got ${dist.localizada}`)
  check('geo:aproximada-5', dist.ubicacion_aproximada === 5, `got ${dist.ubicacion_aproximada}`)
  check('geo:varias-1', dist.varias_ubicaciones === 1, `got ${dist.varias_ubicaciones}`)
  check('geo:nacional-11', dist.nacional === 11, `got ${dist.nacional}`)
  check('geo:internacional-2', dist.internacional === 2, `got ${dist.internacional}`)
  check('geo:sin-ubicacion-7', dist.sin_ubicacion === 7, `got ${dist.sin_ubicacion}`)

  const mappable = (statusRows ?? []).filter((r) => MAPPABLE_STATUSES.has(String(r.geographic_status))).length
  const hidden = (docCount ?? 0) - mappable
  check('map:mappable-10', mappable === 10, `got ${mappable}`)
  check('map:hidden-20', hidden === 20, `got ${hidden}`)

  const { data: runs, error: runsErr } = await admin
    .from('news_ingestion_runs')
    .select('duplicates, http_requests_made, http_requests_avoided, documents_new')
    .order('finished_at', { ascending: false })
    .limit(2)
  if (runsErr) throw runsErr
  const lastTwo = runs ?? []
  if (lastTwo.length >= 2) {
    const second = lastTwo[1]!
    check(
      'ingestion:second-run-no-article-fetch',
      Number(second.http_requests_made) === 0 && Number(second.http_requests_avoided) >= 30,
      `made=${second.http_requests_made} avoided=${second.http_requests_avoided}`,
    )
    check(
      'ingestion:second-run-duplicates',
      Number(second.duplicates) >= 30 && Number(second.documents_new) === 0,
    )
  } else {
    check('ingestion:has-two-runs', false, `only ${lastTwo.length} runs`)
  }

  // No full body / scripts stored
  const { data: sample, error: sampleErr } = await admin
    .from('news_documents')
    .select('description, permitted_excerpt, raw_metadata, structured_data')
    .limit(5)
  if (sampleErr) throw sampleErr
  for (const row of sample ?? []) {
    const blob = JSON.stringify(row)
    check('content:no-script-tags', !blob.includes('<script'))
    check('content:no-article-body', !blob.includes('articleBody'))
    const descLen = String(row.description ?? '').length
    const excerptLen = String(row.permitted_excerpt ?? '').length
    check('content:short-excerpt', descLen < 500 && excerptLen < 500, `desc=${descLen} excerpt=${excerptLen}`)
  }

  // N1 no crea eventos ni amenazas desde noticias (tablas dedicadas ausentes o vacías).
  for (const table of ['news_events', 'news_signals']) {
    const { count, error } = await admin.from(table).select('id', { count: 'exact', head: true })
    if (error?.message?.includes('does not exist') || error?.code === '42P01') {
      check(`no-table:${table}`, true)
    } else if (error) {
      check(`no-table:${table}`, false, error.message)
    } else {
      check(`events:${table}-empty`, (count ?? 0) === 0, `count=${count}`)
    }
  }
}

// Spanish labels complete
check('labels:processing-spanish', PROCESSING_STATUS_LABELS.ready_for_analysis === 'Lista para análisis')
check('labels:geo-spanish', GEOGRAPHIC_STATUS_LABELS.sin_ubicacion === 'Sin ubicación')

await auditDatabase()

console.log(JSON.stringify({ passes: passes.length, failures: failures.length, failures, passes }, null, 2))
if (failures.length > 0) process.exit(1)
