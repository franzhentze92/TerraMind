#!/usr/bin/env tsx
/**
 * news:audit — Bloques N1+N2: ingesta Prensa Libre, geolocalización, análisis IA.
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
  'src/modules/news/sources/emisoras-unidas/emisoras-unidas.connector.ts',
  'src/modules/news/engines/source-health.ts',
  'src/modules/news/engines/news-sitemap-parser.ts',
  'server/services/news-ingestion.service.ts',
  'server/routes/news.ts',
  'src/pipeline/stores/news.store.ts',
  'supabase/migrations/034_news_intelligence.sql',
  'supabase/migrations/035_news_ingestion_metrics.sql',
  'supabase/migrations/040_emisoras_unidas_source.sql',
  'scripts/news-ingest.ts',
  'src/modules/news/news.test.ts',
  'src/modules/news/emisoras-unidas.test.ts',
]

for (const f of requiredFiles) {
  check(`file:${f}`, existsSync(resolve(ROOT, f)))
}

// Language — no English UI leaks in news pages
const liveSrc = read('src/modules/news/pages/NewsLivePage.tsx')
check('language:listas-para-analisis', liveSrc.includes('Listas para análisis'))
check('language:no-pending-analysis', !liveSrc.includes('Pendientes de análisis'))
check('language:actualizar-noticias', read('src/modules/news/components/NewsIngestionControl.tsx').includes('Actualizar noticias'))
check('language:todas-las-fuentes', liveSrc.includes('Todas las fuentes'))
check('ui:source-filter-select', liveSrc.includes('filters.source_id'))

const ingestUi = read('src/modules/news/components/NewsIngestionControl.tsx')
check('ui:estimate-ingestion', ingestUi.includes('Estimar ingestión') || ingestUi.includes('Estimar'))
check('ui:source-health', ingestUi.includes('health_label') || ingestUi.includes('Estado por fuente'))
check('ui:no-english-health-enum', !ingestUi.includes('degraded') && !ingestUi.includes('operational'))

const registrySrc = read('src/modules/news/connectors/registry.ts')
check('multi:registry-pl', registrySrc.includes('prensa_libre_gt'))
check('multi:registry-eu', registrySrc.includes('emisoras_unidas_gt'))

const detailSrc = read('src/modules/news/pages/NewsDocumentDetailPage.tsx')
check('language:ubicacion-principal', detailSrc.includes('Ubicación principal'))
check('language:nivel-precision', detailSrc.includes('Nivel de precisión'))
check('language:no-canonical-url-block', !detailSrc.includes('URL canónica:'))
check('language:abrir-noticia', detailSrc.includes('Abrir noticia original'))
check('language:fuente-periodistica', detailSrc.includes('Fuente periodística') || detailSrc.includes('source_kind_label'))

const mapSrc = read('src/modules/news/components/NewsDocumentsMap.tsx')
check('language:map-disclaimer', mapSrc.includes('no hechos confirmados ni amenazas'))
check('map:excludes-national', mapSrc.includes("'nacional'"))
check('map:excludes-internacional', mapSrc.includes("'internacional'"))
check('map:excludes-sin-ubicacion', mapSrc.includes("'sin_ubicacion'"))

const ingestSrc = read('server/services/news-ingestion.service.ts')
check('ingestion:early-skip', ingestSrc.includes('decideRevalidation'))
check('ingestion:http-avoided-metric', ingestSrc.includes('http_requests_avoided'))
check('multi:no-pl-instanceof-in-orchestrator', !ingestSrc.includes('instanceof PrensaLibreConnector'))
check('multi:routes-generic', read('server/routes/news.ts').includes('/api/news/sources/'))

async function auditDatabase() {
  const admin = getSupabaseAdmin()

  const { data: sources, error: sourcesErr } = await admin
    .from('news_sources')
    .select('id, code, name, discovery_method, is_enabled, base_url, consecutive_failure_count')
  if (sourcesErr) throw sourcesErr
  const sourceList = sources ?? []
  check('multi:min-two-sources', sourceList.length >= 2, `got ${sourceList.length}`)
  const codes = sourceList.map((s) => s.code)
  check('multi:unique-source-codes', new Set(codes).size === codes.length)
  const pl = sourceList.find((s) => s.code === 'prensa_libre_gt')
  const eu = sourceList.find((s) => s.code === 'emisoras_unidas_gt')
  check('source:prensa-libre-registered', Boolean(pl))
  check('source:emisoras-unidas-registered', Boolean(eu))
  check('source:pl-discovery-news-sitemap', pl?.discovery_method === 'news_sitemap')
  check('source:eu-discovery-news-sitemap', eu?.discovery_method === 'news_sitemap')
  check('source:pl-enabled', pl?.is_enabled === true)
  check('source:eu-enabled', eu?.is_enabled === true)
  check('source:pl-canonical-domain', String(pl?.base_url ?? '').includes('prensalibre.com'))
  check('source:eu-canonical-domain', String(eu?.base_url ?? '').includes('emisorasunidas.com'))

  const { count: docCount, error: docErr } = await admin
    .from('news_documents')
    .select('id', { count: 'exact', head: true })
  if (docErr) throw docErr
  check('documents:total-at-least-60', (docCount ?? 0) >= 60, `got ${docCount}`)

  const { count: plCount } = await admin
    .from('news_documents')
    .select('id', { count: 'exact', head: true })
    .eq('source_id', pl!.id)
  const { count: euCount } = await admin
    .from('news_documents')
    .select('id', { count: 'exact', head: true })
    .eq('source_id', eu!.id)
  check('documents:prensa-libre-30', plCount === 30, `got ${plCount}`)
  check('documents:emisoras-unidas-30', euCount === 30, `got ${euCount}`)

  const { count: readyCount } = await admin
    .from('news_documents')
    .select('id', { count: 'exact', head: true })
    .eq('processing_status', 'ready_for_analysis')
  check('documents:ready-for-analysis', (readyCount ?? 0) >= 60, `got ${readyCount}`)

  const { data: allDocs, error: allDocsErr } = await admin
    .from('news_documents')
    .select(
      'id, source_id, title, canonical_url, canonical_url_hash, content_hash, published_at, geographic_status, description, permitted_excerpt, raw_metadata, structured_data',
    )
  if (allDocsErr) throw allDocsErr
  const docs = allDocs ?? []
  const hashes = docs.map((d) => d.canonical_url_hash)
  check('dedupe:unique-canonical-hashes', new Set(hashes).size === hashes.length)
  check(
    'dedupe:no-cross-source-url-collision',
    docs.every((d) => {
      const sameHashOtherSource = docs.some(
        (o) => o.canonical_url_hash === d.canonical_url_hash && o.source_id !== d.source_id,
      )
      return !sameHashOtherSource
    }),
  )

  const euDocs = docs.filter((d) => d.source_id === eu!.id)
  const plDocs = docs.filter((d) => d.source_id === pl!.id)
  check(
    'eu:domain-approved',
    euDocs.every((d) => /emisorasunidas\.com/i.test(String(d.canonical_url))),
  )
  check(
    'pl:domain-approved',
    plDocs.every((d) => /prensalibre\.com/i.test(String(d.canonical_url))),
  )
  check('eu:title-nonempty', euDocs.every((d) => String(d.title ?? '').trim().length > 0))
  check('eu:published-present', euDocs.every((d) => Boolean(d.published_at)))
  check('eu:hash-present', euDocs.every((d) => Boolean(d.content_hash) && Boolean(d.canonical_url_hash)))

  const validGeo = new Set([
    'localizada',
    'ubicacion_aproximada',
    'varias_ubicaciones',
    'nacional',
    'internacional',
    'sin_ubicacion',
  ])
  check(
    'geo:status-valid',
    docs.every((d) => validGeo.has(String(d.geographic_status))),
  )

  const plDist: Record<string, number> = {}
  for (const row of plDocs) {
    const s = String(row.geographic_status)
    plDist[s] = (plDist[s] ?? 0) + 1
  }
  check('geo:pl-localizada-4', plDist.localizada === 4, `got ${plDist.localizada}`)
  check('geo:pl-aproximada-5', plDist.ubicacion_aproximada === 5, `got ${plDist.ubicacion_aproximada}`)
  check('geo:pl-varias-1', plDist.varias_ubicaciones === 1, `got ${plDist.varias_ubicaciones}`)
  check('geo:pl-nacional-11', plDist.nacional === 11, `got ${plDist.nacional}`)
  check('geo:pl-internacional-2', plDist.internacional === 2, `got ${plDist.internacional}`)
  check('geo:pl-sin-ubicacion-7', plDist.sin_ubicacion === 7, `got ${plDist.sin_ubicacion}`)

  const plMappable = plDocs.filter((r) => MAPPABLE_STATUSES.has(String(r.geographic_status))).length
  check('map:pl-mappable-10', plMappable === 10, `got ${plMappable}`)

  // Política de contenido EU — sin cuerpo/HTML/scripts
  let euContentFail = 0
  let euMaxDesc = 0
  let euMaxExcerpt = 0
  for (const row of euDocs) {
    const desc = String(row.description ?? '')
    const excerpt = String(row.permitted_excerpt ?? '')
    euMaxDesc = Math.max(euMaxDesc, desc.length)
    euMaxExcerpt = Math.max(euMaxExcerpt, excerpt.length)
    const blob = JSON.stringify({
      description: row.description,
      permitted_excerpt: row.permitted_excerpt,
      raw_metadata: row.raw_metadata,
      structured_data: row.structured_data,
    })
    if (
      blob.includes('<script') ||
      blob.includes('articleBody') ||
      /<\/?(?:div|article|p|style)\b/i.test(desc) ||
      desc.length > 800 ||
      excerpt.length > 800
    ) {
      euContentFail += 1
    }
  }
  check('content:eu-no-full-body', euContentFail === 0, `failing=${euContentFail}`)
  check('content:eu-excerpt-bounded', euMaxDesc <= 600 && euMaxExcerpt <= 600, `desc=${euMaxDesc} excerpt=${euMaxExcerpt}`)

  // Incrementalidad por fuente (última corrida EU exitosa de solo cache)
  const { data: euRuns, error: euRunsErr } = await admin
    .from('news_ingestion_runs')
    .select('duplicates, http_requests_made, http_requests_avoided, documents_new, result_code')
    .eq('source_id', eu!.id)
    .order('finished_at', { ascending: false })
    .limit(2)
  if (euRunsErr) throw euRunsErr
  const euSecond = (euRuns ?? [])[0]
  check(
    'ingestion:eu-incremental-cache',
    Boolean(euSecond) &&
      Number(euSecond!.http_requests_made) === 0 &&
      Number(euSecond!.http_requests_avoided) >= 30 &&
      Number(euSecond!.documents_new) === 0,
    `made=${euSecond?.http_requests_made} avoided=${euSecond?.http_requests_avoided}`,
  )

  const { data: plRuns } = await admin
    .from('news_ingestion_runs')
    .select('id')
    .eq('source_id', pl!.id)
    .limit(1)
  check('ingestion:pl-still-has-runs', (plRuns?.length ?? 0) >= 1)

  // Health independiente: un fallo de una fuente no se modela como cascada
  check(
    'health:independent-counters',
    sourceList.every((s) => typeof s.consecutive_failure_count === 'number'),
  )

  // No full body / scripts sample (ambas fuentes)
  const sample = docs.slice(0, 8)
  for (const row of sample) {
    const blob = JSON.stringify(row)
    check('content:no-script-tags', !blob.includes('<script'))
    check('content:no-article-body', !blob.includes('articleBody'))
  }

  // N1/N2 no crean eventos ni amenazas desde noticias (tablas dedicadas ausentes o vacías).
  for (const table of ['news_events', 'news_signals', 'news_cross_source_groups']) {
    const { count, error } = await admin.from(table).select('id', { count: 'exact', head: true })
    if (error?.message?.includes('does not exist') || error?.code === '42P01') {
      check(`no-table:${table}`, true)
    } else if (error) {
      check(`no-table:${table}`, false, error.message)
    } else {
      check(`events:${table}-empty`, (count ?? 0) === 0, `count=${count}`)
    }
  }

  // ── N2: análisis documental ──────────────────────────────────────────
  const n2Files = [
    'src/modules/news/schemas/ai-analysis.schema.ts',
    'src/modules/news/engines/analysis-evidence-validator.ts',
    'src/modules/news/engines/relation-semantics.ts',
    'src/modules/news/engines/escalation-policy.ts',
    'src/modules/news/providers/analysis-prompts.ts',
    'src/modules/news/components/NewsDocumentAnalysisSection.tsx',
    'server/services/news-analysis.service.ts',
    'src/pipeline/stores/news-analysis.store.ts',
    'supabase/migrations/036_news_document_analysis.sql',
    'supabase/migrations/037_news_analysis_quality.sql',
    'supabase/migrations/038_news_analysis_quantitative.sql',
    'supabase/migrations/039_news_analysis_coverage.sql',
  ]
  for (const f of n2Files) {
    check(`n2:file:${f}`, existsSync(resolve(ROOT, f)))
  }

  const schemaSrc = read('src/modules/news/schemas/ai-analysis.schema.ts')
  check('n2:schema:prompt-v2', /ANALYSIS_PROMPT_VERSION = 'document-analysis\.v2/.test(schemaSrc))
  check('n2:schema:metrics', schemaSrc.includes('documentMetricSchema'))
  check('n2:schema:coverage', schemaSrc.includes('documentCoverageSchema'))
  check('n2:schema:primary-source', schemaSrc.includes('recommendedPrimarySourceSchema'))
  check('n2:schema:threat-hint', schemaSrc.includes('threatEvaluationHintSchema'))
  check('n2:schema:event-candidate-no-persist', schemaSrc.includes('eventCandidateSchema'))

  const validatorSrc = read('src/modules/news/engines/analysis-evidence-validator.ts')
  check('n2:validator:evidence', validatorSrc.includes('excerptExistsInCorpus'))
  check('n2:validator:atomic', validatorSrc.includes('isLikelyNonAtomic'))
  check('n2:validator:confidence-cap', validatorSrc.includes('MAX_EXTRACTION_CONFIDENCE'))
  check('n2:validator:damnificadas', validatorSrc.includes('disaster_affected_families'))
  check('n2:validator:coverage-infer', validatorSrc.includes('inferDocumentCoverage'))

  const labelsSrc = read('src/modules/news/presentation/news-analysis-labels.ts')
  check('n2:labels:affected-families', labelsSrc.includes("affected_families: 'Familias afectadas'"))
  check('n2:labels:damnificadas', labelsSrc.includes("disaster_affected_families: 'Familias damnificadas'"))
  check(
    'n2:labels:distinct-types',
    /(?:^|\n)\s*affected_families: 'Familias afectadas'/.test(labelsSrc) &&
      /disaster_affected_families: 'Familias damnificadas'/.test(labelsSrc) &&
      !/(?:^|\n)\s*affected_families: 'Familias damnificadas'/.test(labelsSrc),
  )

  const uiSrc = read('src/modules/news/components/NewsDocumentAnalysisSection.tsx')
  check('n2:ui:spanish-hecho', uiSrc.includes('Hecho principal'))
  check('n2:ui:spanish-afirmaciones', uiSrc.includes('Afirmaciones verificables'))
  check('n2:ui:spanish-candidato', uiSrc.includes('Candidato a evento'))
  check('n2:ui:spanish-cobertura', uiSrc.includes('Cobertura documental'))
  check('n2:ui:spanish-fuente-primaria', uiSrc.includes('Fuente primaria recomendada'))
  check('n2:ui:no-event-created', uiSrc.includes('No se crea el evento todavía'))
  check('n2:ui:no-threat-promoted', uiSrc.includes('No se promueve ni se cuenta como amenaza'))
  check('n2:ui:no-gpt-leak', !/\bgpt-4\b/i.test(uiSrc) && !uiSrc.includes('openai'))
  check('n2:ui:no-cost-leak', !uiSrc.includes('estimated_cost') && !uiSrc.includes('token_usage'))
  check('n2:ui:no-raw-json', !uiSrc.includes('raw_model_response') && !uiSrc.includes('JSON.stringify'))
  check('n2:ui:historial', uiSrc.includes('Historial de análisis'))
  check('n2:ui:no-schema-version-leak', !uiSrc.includes('ai-output.v2') && !uiSrc.includes('analysis_version}'))

  const svcSrc = read('server/services/news-analysis.service.ts')
  check('n2:service:no-threat-insert', !/from\(['\"]canonical_threats['\"]\)/.test(svcSrc))
  check('n2:service:no-event-table', !/from\(['\"]news_events['\"]\)/.test(svcSrc))
  check('n2:service:escalation', svcSrc.includes('shouldEscalateToDeep'))

  const escSrc = read('src/modules/news/engines/escalation-policy.ts')
  check('n2:escalation:future-note', escSrc.includes('Mejora futura'))

  // Persistencia N2 — afirmaciones con evidencia; 0 eventos/amenazas desde noticias
  const { count: analysisCount } = await admin
    .from('news_document_analyses')
    .select('id', { count: 'exact', head: true })
    .in('status', ['completed', 'completed_with_warnings', 'needs_review'])
  check('n2:db:has-analyses', (analysisCount ?? 0) >= 5, `got ${analysisCount}`)

  const { count: euAnalysisCount } = await admin
    .from('news_document_analyses')
    .select('id', { count: 'exact', head: true })
    .in(
      'document_id',
      euDocs.map((d) => d.id),
    )
  check('n2:db:eu-zero-analyses', (euAnalysisCount ?? 0) === 0, `got ${euAnalysisCount}`)

  const { count: plAnalysisCount } = await admin
    .from('news_document_analyses')
    .select('id', { count: 'exact', head: true })
    .in(
      'document_id',
      plDocs.map((d) => d.id),
    )
  check('n2:db:pl-analyses-preserved', (plAnalysisCount ?? 0) >= 5, `got ${plAnalysisCount}`)

  const { data: promptVersions } = await admin
    .from('news_document_analyses')
    .select('prompt_version')
    .in('prompt_version', [
      'document-analysis.v2.2.1',
      'document-analysis.v2.3.1',
      'document-analysis.v2.4',
    ])
  const versions = new Set((promptVersions ?? []).map((r) => r.prompt_version))
  check('n2:db:ref-v2.2.1', versions.has('document-analysis.v2.2.1'))
  check('n2:db:ref-v2.3.1', versions.has('document-analysis.v2.3.1'))
  check('n2:db:ref-v2.4', versions.has('document-analysis.v2.4'))

  const { data: claims, error: claimsErr } = await admin
    .from('news_claims')
    .select('id, epistemic_status, confidence, evidence_references')
    .limit(50)
  if (claimsErr) throw claimsErr
  check('n2:db:has-claims', (claims?.length ?? 0) > 0)
  const claimsWithoutEvidence = (claims ?? []).filter((c) => {
    const ev = c.evidence_references
    return !Array.isArray(ev) || ev.length === 0
  })
  check('n2:db:claims-have-evidence', claimsWithoutEvidence.length === 0, `missing=${claimsWithoutEvidence.length}`)
  check(
    'n2:db:claims-have-epistemic',
    (claims ?? []).every((c) => Boolean(c.epistemic_status)),
  )
  check(
    'n2:db:claims-have-confidence',
    (claims ?? []).every((c) => typeof c.confidence === 'number'),
  )

  const { data: metricRows } = await admin
    .from('news_document_analyses')
    .select('id, metrics')
    .not('metrics', 'eq', '[]')
  let wrongDamnificadas = 0
  for (const row of metricRows ?? []) {
    const metrics = Array.isArray(row.metrics) ? row.metrics : []
    for (const m of metrics as Array<{ label?: string; metricType?: string }>) {
      if (/damnificad/i.test(String(m.label ?? '')) && m.metricType === 'affected_families') {
        wrongDamnificadas += 1
      }
    }
  }
  check('n2:db:damnificadas-type', wrongDamnificadas === 0, `wrong=${wrongDamnificadas}`)

  const { count: threatCount } = await admin
    .from('canonical_threats')
    .select('id', { count: 'exact', head: true })
  check('n2:db:zero-threats', (threatCount ?? 0) === 0, `got ${threatCount}`)
}

// Spanish labels complete
check('labels:processing-spanish', PROCESSING_STATUS_LABELS.ready_for_analysis === 'Lista para análisis')
check('labels:geo-spanish', GEOGRAPHIC_STATUS_LABELS.sin_ubicacion === 'Sin ubicación')

await auditDatabase()

console.log(JSON.stringify({ passes: passes.length, failures: failures.length, failures, passes }, null, 2))
if (failures.length > 0) process.exit(1)
