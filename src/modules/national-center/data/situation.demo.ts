import type { ConfidenceLevel, SourceType, StrategicQuestionId } from '@/intelligence/types'

/**
 * Datos de demostración para prototipo UX.
 * Reemplazar con datos reales cuando las fuentes estén conectadas.
 */
export interface NationalMetrics {
  sourcesConnected: number
  observationsToday: number
  anomaliesDetected: number
  nationalConfidence: number
}

export interface ActivityEvent {
  id: string
  source: string
  sourceType: SourceType
  message: string
  timestamp: string
  status: 'completed' | 'processing' | 'queued'
}

export interface StrategicAnswer {
  questionId: StrategicQuestionId
  summary: string
  count: number
  countLabel: string
  confidence: ConfidenceLevel
}

export interface TopFinding {
  id: string
  title: string
  description: string
  confidence: ConfidenceLevel
  confidencePercent: number
  sources: string[]
  hypothesis: string
  impact: string
  recommendation: string
  detectedAt: string
}

export interface TimelineEvent {
  id: string
  time: string
  label: string
  type: 'data' | 'analysis' | 'confirmation' | 'report' | 'strategy'
}

export interface MorningBriefStats {
  pixelsAnalyzed: string
  officialSources: number
  variables: number
  climateModels: number
  situationsRequiringAttention: number
}

export const DEMO_METRICS: NationalMetrics = {
  sourcesConnected: 12,
  observationsToday: 1_800_000,
  anomaliesDetected: 17,
  nationalConfidence: 94,
}

export const DEMO_ACTIVITY: ActivityEvent[] = [
  { id: '1', source: 'NASA FIRMS', sourceType: 'firms', message: 'Nuevos incendios detectados — Petén', timestamp: new Date().toISOString(), status: 'completed' },
  { id: '2', source: 'Sentinel-2', sourceType: 'sentinel', message: 'Nuevas imágenes procesadas — corredor seco', timestamp: new Date().toISOString(), status: 'completed' },
  { id: '3', source: 'ERA5', sourceType: 'climate', message: 'Clima actualizado — anomalía térmica +2.1°C', timestamp: new Date().toISOString(), status: 'completed' },
  { id: '4', source: 'Noticias oficiales', sourceType: 'news', message: '27 artículos analizados', timestamp: new Date().toISOString(), status: 'completed' },
  { id: '5', source: 'INSIVUMEH', sourceType: 'official', message: 'Boletín hidrometeorológico leído', timestamp: new Date().toISOString(), status: 'completed' },
  { id: '6', source: 'Motor de IA', sourceType: 'official', message: 'Razonamiento completado — 3 hipótesis', timestamp: new Date().toISOString(), status: 'processing' },
  { id: '7', source: 'CHIRPS', sourceType: 'climate', message: 'Precipitación actualizada — déficit confirmado', timestamp: new Date().toISOString(), status: 'completed' },
  { id: '8', source: 'SoilGrids', sourceType: 'soil', message: 'Índices de humedad del suelo recalculados', timestamp: new Date().toISOString(), status: 'queued' },
]

export const DEMO_STRATEGIC_ANSWERS: StrategicAnswer[] = [
  { questionId: 'what-is-happening', summary: 'Deterioro acelerado del corredor seco y aumento de focos de calor', count: 3, countLabel: 'hallazgos nuevos', confidence: 'high' },
  { questionId: 'why-is-it-happening', summary: 'Estrés hídrico prolongado y temperaturas sobre la media histórica', count: 2, countLabel: 'hipótesis confirmadas', confidence: 'high' },
  { questionId: 'what-could-happen', summary: 'Expansión del déficit hídrico hacia regiones agrícolas del sur', count: 1, countLabel: 'escenario crítico', confidence: 'medium' },
  { questionId: 'what-deserves-attention', summary: 'Corredor seco y cuenca del Motagua requieren intervención inmediata', count: 4, countLabel: 'prioridades activas', confidence: 'high' },
  { questionId: 'what-strategies', summary: 'Validación en campo y activación de protocolo de sequía', count: 2, countLabel: 'estrategias propuestas', confidence: 'high' },
]

export const DEMO_TOP_FINDING: TopFinding = {
  id: 'finding-001',
  title: 'Deterioro acelerado del corredor seco',
  description: 'Análisis multisensorial detectó reducción significativa del índice de vegetación (NDVI) en 8 departamentos durante las últimas 3 semanas, correlacionado con déficit pluviométrico y temperaturas anómalas.',
  confidence: 'high',
  confidencePercent: 96,
  sources: ['Sentinel-2', 'ERA5', 'CHIRPS', 'NASA FIRMS', 'Noticias'],
  hypothesis: 'Estrés hídrico prolongado como causa principal del deterioro vegetativo.',
  impact: '8 departamentos afectados — 240,000 ha en zona de riesgo.',
  recommendation: 'Validar en campo y activar monitoreo intensivo en cuencas críticas.',
  detectedAt: new Date().toISOString(),
}

export const DEMO_TIMELINE: TimelineEvent[] = [
  { id: 't1', time: '08:03', label: 'Nueva imagen Sentinel procesada', type: 'data' },
  { id: 't2', time: '08:11', label: 'IA detectó anomalía en NDVI', type: 'analysis' },
  { id: 't3', time: '08:15', label: 'Confirmado con datos CHIRPS', type: 'confirmation' },
  { id: 't4', time: '08:18', label: 'Informe preliminar generado', type: 'report' },
  { id: 't5', time: '08:19', label: 'Estrategia de respuesta creada', type: 'strategy' },
]

export const DEMO_BRIEF_STATS: MorningBriefStats = {
  pixelsAnalyzed: '14 millones',
  officialSources: 11,
  variables: 382,
  climateModels: 4,
  situationsRequiringAttention: 5,
}

export const OBSERVING_SOURCES = [
  'NASA FIRMS',
  'ERA5',
  'Sentinel-2',
  'CHIRPS',
  'INSIVUMEH',
  'Noticias oficiales',
  'Motor de IA',
] as const

export const OBSERVING_ACTIONS = [
  'Analizando',
  'Actualizando',
  'Procesando',
  'Generando hipótesis',
  'Correlacionando',
  'Evaluando anomalías',
] as const
