/**
 * Dry-run de elegibilidad N2 para documentos de Emisoras Unidas (sin llamar al LLM).
 *
 * Cobertura esperada — calculada solo con campos realmente persistidos.
 * No afirma “alta” de forma definitiva antes del análisis IA.
 */
import { config } from 'dotenv'
import { resolve } from 'node:path'
import {
  buildPermittedDocumentContent,
  hashPermittedContent,
} from '../src/modules/news/engines/build-permitted-content'
import { listNewsDocuments, listNewsSources } from '../src/pipeline/stores/news.store'

config({ path: resolve(process.cwd(), '.env') })

type ExpectedCoverage =
  | 'Suficiente para análisis inicial'
  | 'Parcial'
  | 'Insuficiente'
  | 'Pendiente de evaluación'

function expectedCoverage(fields: {
  title: boolean
  description: boolean
  excerpt: boolean
  publishedAt: boolean
  jsonLd: number
  corpusChars: number
}): { label: ExpectedCoverage; limitations: string[] } {
  const limitations: string[] = []
  if (!fields.title) limitations.push('Sin título')
  if (!fields.description && !fields.excerpt) {
    limitations.push('Sin descripción ni extracto persistido')
  }
  if (!fields.publishedAt) limitations.push('Sin fecha de publicación')
  if (fields.jsonLd === 0) limitations.push('Sin JSON-LD')
  if (fields.corpusChars < 80) limitations.push('Corpus textual muy corto')

  const hasCore = fields.title && (fields.description || fields.excerpt)
  if (!hasCore || fields.corpusChars < 40) {
    return { label: 'Insuficiente', limitations }
  }
  if (limitations.length === 0 && fields.corpusChars >= 120) {
    return { label: 'Suficiente para análisis inicial', limitations }
  }
  if (limitations.length <= 2) {
    return { label: 'Parcial', limitations }
  }
  return { label: 'Pendiente de evaluación', limitations }
}

async function main() {
  const sources = await listNewsSources()
  const eu = sources.find((s) => s.code === 'emisoras_unidas_gt')
  if (!eu) throw new Error('Emisoras Unidas no registrada')

  const { rows } = await listNewsDocuments({ sourceId: eu.id, limit: 40 })
  if (rows.length === 0) {
    console.log(JSON.stringify({ error: 'Sin documentos de Emisoras Unidas' }, null, 2))
    return
  }

  const pick = (predicate: (row: (typeof rows)[0]) => boolean) =>
    rows.find(predicate) ?? rows[0]!

  const candidates = [
    {
      label: 'salud_ambiente_seguridad_economia',
      row: pick(
        (r) =>
          /salud|ambiente|seguridad|economia|empresas|transporte|combustible|bono|pnc/i.test(
            `${r.title} ${r.preliminary_category ?? ''} ${r.source_category ?? ''}`,
          ),
      ),
    },
    {
      label: 'territorial_o_vial',
      row: pick(
        (r) =>
          /ruta|accidente|zona|municipio|departamento|carretera|incendio|lluvia|rio|onda/i.test(
            `${r.title} ${r.description ?? ''}`,
          ) ||
          r.geographic_status === 'localizada' ||
          r.geographic_status === 'ubicacion_aproximada',
      ),
    },
    {
      label: 'nacional_o_institucional',
      row: pick(
        (r) =>
          /gobierno|conred|contralor|diputad|rector|arqueolog|instituc/i.test(r.title) ||
          /Nacional/i.test(r.source_category ?? ''),
      ),
    },
  ]

  const used = new Set<string>()
  const unique = candidates.map((c, idx) => {
    if (!used.has(c.row.id)) {
      used.add(c.row.id)
      return c
    }
    const alt = rows.find((r) => !used.has(r.id)) ?? c.row
    used.add(alt.id)
    return { ...c, row: alt, label: `${c.label}_alt${idx}` }
  })

  const report = unique.map(({ label, row }) => {
    const permitted = buildPermittedDocumentContent(row, 'Emisoras Unidas')
    const corpusChars =
      permitted.title.length +
      (permitted.description?.length ?? 0) +
      (permitted.permittedExcerpt?.length ?? 0) +
      (permitted.subtitle?.length ?? 0) +
      JSON.stringify(permitted.jsonLd).length +
      JSON.stringify(permitted.openGraph).length

    const fields = {
      title: Boolean(permitted.title),
      description: Boolean(permitted.description),
      excerpt: Boolean(permitted.permittedExcerpt),
      publishedAt: Boolean(permitted.publishedAt),
      jsonLd: permitted.jsonLd.length,
      corpusChars,
    }
    const coverage = expectedCoverage(fields)
    const estimatedTokens = Math.ceil(corpusChars / 4)

    return {
      slot: label,
      documentId: row.id,
      title: row.title,
      category: row.source_category,
      geographic_status: row.geographic_status,
      corpus_disponible: 'título, descripción y metadatos',
      campos_disponibles: {
        title: fields.title,
        description: fields.description,
        excerpt: fields.excerpt,
        publishedAt: fields.publishedAt,
        jsonLd: fields.jsonLd,
        openGraphKeys: Object.keys(permitted.openGraph),
      },
      longitud_aproximada_corpus_chars: corpusChars,
      cobertura_esperada: coverage.label,
      limitaciones: coverage.limitations,
      modelo_recomendado: 'fast (sin ejecución real)',
      content_hash: hashPermittedContent(permitted),
      costo_estimado: {
        estimatedTokens,
        note: 'Estimación heurística; no se ejecutó el modelo',
      },
    }
  })

  console.log(
    JSON.stringify(
      {
        aviso:
          'Dry-run de elegibilidad N2 — cobertura esperada según campos persistidos; no se ejecutó análisis real',
        candidatos: report,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
