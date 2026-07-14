/**
 * Diagnóstico offline: posibles coincidencias entre fuentes (no N3).
 * No persiste grupos ni cambia confianza.
 */
import { config } from 'dotenv'
import { resolve } from 'node:path'
import { listNewsDocuments, listNewsSources } from '../src/pipeline/stores/news.store'

config({ path: resolve(process.cwd(), '.env') })

function tokenize(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 4),
  )
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  const union = a.size + b.size - inter
  return union === 0 ? 0 : inter / union
}

function daysApart(a: string | null, b: string | null): number | null {
  if (!a || !b) return null
  const da = Date.parse(a)
  const db = Date.parse(b)
  if (Number.isNaN(da) || Number.isNaN(db)) return null
  return Math.abs(da - db) / (1000 * 60 * 60 * 24)
}

async function main() {
  const sources = await listNewsSources()
  const pl = sources.find((s) => s.code === 'prensa_libre_gt')
  const eu = sources.find((s) => s.code === 'emisoras_unidas_gt')
  if (!pl || !eu) {
    console.log(JSON.stringify({ error: 'Faltan fuentes registradas', sources: sources.map((s) => s.code) }, null, 2))
    return
  }

  const plDocs = await listNewsDocuments({ sourceId: pl.id, limit: 80 })
  const euDocs = await listNewsDocuments({ sourceId: eu.id, limit: 80 })

  const pairs: Array<{
    documento_a: { id: string; fuente: string; titulo: string; fecha: string | null }
    documento_b: { id: string; fuente: string; titulo: string; fecha: string | null }
    razon_similitud: string[]
    puntuacion_orientativa: number
    advertencia: string
  }> = []

  for (const a of plDocs.rows) {
    const ta = tokenize(a.title)
    for (const b of euDocs.rows) {
      const tb = tokenize(b.title)
      const score = jaccard(ta, tb)
      const reasons: string[] = []
      if (score >= 0.22) reasons.push(`Similitud de títulos (${(score * 100).toFixed(0)}%)`)
      const gap = daysApart(a.published_at, b.published_at)
      if (gap != null && gap <= 2) reasons.push(`Fechas cercanas (${gap.toFixed(1)} días)`)
      const shared = [...ta].filter((t) => tb.has(t))
      const geoHint = shared.filter((t) =>
        /conred|lluvias?|familia|damnific|municipio|departamento|ruta|carretera|zona|pnc|salud|incendio|accidente|piloto|bus|automovil|agua|sat|contralor|bono|combustible|escuintla|mixco/.test(
          t,
        ),
      )
      if (geoHint.length >= 1) reasons.push(`Términos compartidos: ${geoHint.slice(0, 5).join(', ')}`)
      if (
        a.geographic_status === b.geographic_status &&
        (a.geographic_status === 'localizada' || a.geographic_status === 'ubicacion_aproximada')
      ) {
        reasons.push(`Misma clase geográfica: ${a.geographic_status}`)
      }

      // Exige señal de contenido (título o términos específicos), no solo "Guatemala"+fecha.
      const hasContentSignal = score >= 0.2 || geoHint.length >= 1
      const weighted =
        score +
        (gap != null && gap <= 1.5 ? 0.12 : 0) +
        Math.min(0.25, geoHint.length * 0.1)
      if (hasContentSignal && reasons.length >= 2 && weighted >= 0.22) {
        pairs.push({
          documento_a: {
            id: a.id,
            fuente: 'Prensa Libre',
            titulo: a.title,
            fecha: a.published_at,
          },
          documento_b: {
            id: b.id,
            fuente: 'Emisoras Unidas',
            titulo: b.title,
            fecha: b.published_at,
          },
          razon_similitud: reasons,
          puntuacion_orientativa: Number(weighted.toFixed(3)),
          advertencia:
            'Posibles coincidencias para revisión — aún no agrupadas; no constituyen corroboración ni evento.',
        })
      }
    }
  }

  pairs.sort((x, y) => y.puntuacion_orientativa - x.puntuacion_orientativa)
  const top = pairs.slice(0, 10)

  console.log(
    JSON.stringify(
      {
        etiqueta: 'Posibles coincidencias para revisión',
        prensa_libre_docs: plDocs.rows.length,
        emisoras_unidas_docs: euDocs.rows.length,
        pares_candidatos: top.length,
        pares: top,
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
