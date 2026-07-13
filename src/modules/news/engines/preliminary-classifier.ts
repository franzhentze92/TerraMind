import type { NewsPreliminaryCategory } from '../types/news.types'

export const CLASSIFIER_VERSION = 'preliminary-rules.v1'

interface ClassificationRule {
  category: NewsPreliminaryCategory
  weight: number
  patterns: RegExp[]
  reason: string
}

const RULES: ClassificationRule[] = [
  {
    category: 'gobierno_politica',
    weight: 1,
    patterns: [/politica/i, /gobierno/i, /congreso/i, /presidente/i, /ministro/i, /mp/i, /diputad/i],
    reason: 'Coincidencia con términos de gobierno o política',
  },
  {
    category: 'economia',
    weight: 1,
    patterns: [/econom/i, /inflaci/i, /empresa/i, /negocio/i, /banca/i, /mercado/i],
    reason: 'Coincidencia con términos económicos',
  },
  {
    category: 'agricultura',
    weight: 1,
    patterns: [/agricol/i, /cultivo/i, /cosecha/i, /café/i, /cafe/i, /ma[ií]z/i, /campesin/i],
    reason: 'Coincidencia con términos agrícolas',
  },
  {
    category: 'ambiente',
    weight: 1,
    patterns: [/ambient/i, /clima/i, /bosque/i, /deforest/i, /contamin/i, /fauna/i, /flora/i],
    reason: 'Coincidencia con términos ambientales',
  },
  {
    category: 'salud',
    weight: 1,
    patterns: [/salud/i, /hospital/i, /enfermedad/i, /vacuna/i, /epidemi/i, /mspas/i],
    reason: 'Coincidencia con términos de salud',
  },
  {
    category: 'infraestructura_movilidad',
    weight: 1,
    patterns: [/carretera/i, /puente/i, /transito/i, /tránsito/i, /transporte/i, /metro/i, /aeropuerto/i],
    reason: 'Coincidencia con infraestructura o movilidad',
  },
  {
    category: 'seguridad',
    weight: 1,
    patterns: [/seguridad/i, /balacera/i, /extorsi/i, /mara/i, /pandilla/i, /secuestro/i],
    reason: 'Coincidencia con términos de seguridad',
  },
  {
    category: 'justicia',
    weight: 1,
    patterns: [/justicia/i, /juez/i, /fiscal/i, /tribunal/i, /sentencia/i, /mp\b/i, /detenid/i],
    reason: 'Coincidencia con términos de justicia',
  },
  {
    category: 'educacion',
    weight: 1,
    patterns: [/educaci/i, /universidad/i, /escuela/i, /mineduc/i, /estudiant/i],
    reason: 'Coincidencia con términos de educación',
  },
  {
    category: 'energia',
    weight: 1,
    patterns: [/energ/i, /electric/i, /petr[oó]leo/i, /hidroel[eé]ctric/i],
    reason: 'Coincidencia con términos de energía',
  },
  {
    category: 'internacional',
    weight: 1,
    patterns: [/internacional/i, /mundial/i, /onu/i, /ee\.?uu/i, /estados unidos/i, /mexico|méxico/i],
    reason: 'Coincidencia con cobertura internacional',
  },
  {
    category: 'sociedad',
    weight: 0.6,
    patterns: [/sociedad/i, /comunitari/i, /familia/i, /cultura/i, /vida\b/i],
    reason: 'Coincidencia con temas de sociedad',
  },
]

const CATEGORY_PATH_MAP: Array<{ prefix: string; category: NewsPreliminaryCategory; reason: string }> = [
  { prefix: '/guatemala/politica', category: 'gobierno_politica', reason: 'Ruta editorial de política' },
  { prefix: '/guatemala/justicia', category: 'justicia', reason: 'Ruta editorial de justicia' },
  { prefix: '/guatemala/economia', category: 'economia', reason: 'Ruta editorial de economía' },
  { prefix: '/guatemala/comunitario', category: 'sociedad', reason: 'Ruta editorial comunitaria' },
  { prefix: '/guatemala/planeta', category: 'ambiente', reason: 'Ruta editorial ambiental' },
  { prefix: '/deportes/futbol-internacional', category: 'internacional', reason: 'Sección deportiva internacional' },
  { prefix: '/deportes', category: 'otra', reason: 'Sección deportiva' },
  { prefix: '/vida', category: 'sociedad', reason: 'Sección vida y sociedad' },
]

export function classifyPreliminaryCategory(input: {
  title?: string | null
  description?: string | null
  sourceCategory?: string | null
  urlPath?: string
  sourceTags?: string[]
}): {
  category: NewsPreliminaryCategory
  confidence: number
  reasons: string[]
  version: string
} {
  const corpus = [
    input.title ?? '',
    input.description ?? '',
    input.sourceCategory ?? '',
    ...(input.sourceTags ?? []),
  ].join(' ')

  const scores = new Map<NewsPreliminaryCategory, { score: number; reasons: string[] }>()

  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(corpus))) {
      const prev = scores.get(rule.category) ?? { score: 0, reasons: [] }
      prev.score += rule.weight
      prev.reasons.push(rule.reason)
      scores.set(rule.category, prev)
    }
  }

  if (input.urlPath) {
    for (const mapping of CATEGORY_PATH_MAP) {
      if (input.urlPath.includes(mapping.prefix)) {
        const prev = scores.get(mapping.category) ?? { score: 0, reasons: [] }
        prev.score += 1.2
        prev.reasons.push(mapping.reason)
        scores.set(mapping.category, prev)
        break
      }
    }
  }

  if (input.sourceCategory) {
    const cat = input.sourceCategory.toLowerCase()
    if (cat.includes('justicia')) {
      const prev = scores.get('justicia') ?? { score: 0, reasons: [] }
      prev.score += 1.5
      prev.reasons.push(`Categoría original: ${input.sourceCategory}`)
      scores.set('justicia', prev)
    }
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1].score - a[1].score)
  if (ranked.length === 0) {
    return {
      category: 'otra',
      confidence: 0.25,
      reasons: ['Sin coincidencias determinísticas claras'],
      version: CLASSIFIER_VERSION,
    }
  }

  const [category, data] = ranked[0]!
  const maxPossible = 3
  const confidence = Math.min(0.95, Math.max(0.35, data.score / maxPossible))
  return {
    category,
    confidence: Number(confidence.toFixed(2)),
    reasons: [...new Set(data.reasons)].slice(0, 5),
    version: CLASSIFIER_VERSION,
  }
}
