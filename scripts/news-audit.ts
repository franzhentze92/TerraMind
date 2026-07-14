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

  // N1/N2 no crean eventos ni amenazas desde noticias (tablas dedicadas ausentes o vacías).
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
