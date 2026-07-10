import type { ConfidenceLevel } from '@/intelligence/types'

export type PriorityLevel = 'critica' | 'alta' | 'media' | 'baja'

export interface DailyBriefHeader {
  countryName: string
  countryCode: string
  eventsToday: number
  lastUpdatedSecondsAgo: number
  systemStatus: 'operational' | 'degraded' | 'processing'
  sourcesActive: number
  observationsToday: number
  hallazgosToday: number
  nationalConfidence: number
}

export type BriefPriority = 'critica' | 'atencion' | 'positivo'

export interface BriefSituation {
  id: string
  titulo: string
  prioridad: BriefPriority
}

export interface ExecutiveBrief {
  greeting: string
  situacionesPrioritarias: number
  criticas: BriefSituation[]
  atencion: BriefSituation[]
  positivos: BriefSituation[]
  fullAnalysis: string
  stats: {
    sources: number | string
    observations: string | number
    events: number
    hallazgos?: number
    detectionsNational?: number
    attention?: number
  }
  generatedAt: string
  priorityIntro?: string
  isLive?: boolean
}

export type IndicatorLevel = 'BAJO' | 'NORMAL' | 'ALTO' | 'CRÍTICO'

export interface CountryIndicator {
  id: string
  label: string
  score: number
  level: IndicatorLevel
  change7d: number
  trend: 'up' | 'down' | 'stable'
  status: 'good' | 'warning' | 'critical'
  subtitle?: string
  contextLabel?: string
}

export interface HallazgoExpediente {
  id: string
  codigo: string
  rank: number
  titulo: string
  descripcion: string
  prioridad: PriorityLevel
  confianza: number
  confianzaNivel: ConfidenceLevel
  fecha: string
  territorio: string
  evidencias: string[]
  hipotesis: string
  riesgo: string
  estrategia: string
  impactoEsperado: 'Bajo' | 'Medio' | 'Alto' | 'Crítico'
  consecuencia: string
}

export type TimelineStatus = 'processed' | 'analyzing' | 'waiting'

export interface TimelineEntry {
  id: string
  time: string
  label: string
  source?: string
  status: TimelineStatus
}

export interface DataSource {
  id: string
  name: string
  status: 'connected' | 'syncing' | 'offline' | 'degraded'
  lastSync?: string
  avgLatency?: string
  variables: string[]
}

export interface SuggestedAction {
  id: string
  action: string
  hallazgoCodigo: string
  horizonte: string
}

export const DAILY_BRIEF_HEADER: DailyBriefHeader = {
  countryName: 'Guatemala',
  countryCode: 'GT',
  eventsToday: 41,
  lastUpdatedSecondsAgo: 37,
  systemStatus: 'operational',
  sourcesActive: 12,
  observationsToday: 2_840_000,
  hallazgosToday: 8,
  nationalConfidence: 91,
}

export const EXECUTIVE_BRIEF: ExecutiveBrief = {
  greeting: 'Buenos días.',
  situacionesPrioritarias: 4,
  criticas: [
    { id: 's1', titulo: 'Deterioro acelerado del corredor seco', prioridad: 'critica' },
    { id: 's2', titulo: 'Nuevos focos de calor en Petén', prioridad: 'critica' },
  ],
  atencion: [
    { id: 's3', titulo: 'Déficit hídrico en cuenca del Motagua', prioridad: 'atencion' },
  ],
  positivos: [
    { id: 's4', titulo: 'Recuperación agrícola en Alta Verapaz', prioridad: 'positivo' },
  ],
  fullAnalysis:
    'Durante las últimas 24 horas el sistema analizó información satelital, meteorológica y ambiental de todo el territorio nacional. El corredor seco continúa mostrando deterioro progresivo de la cobertura vegetal correlacionado con déficit pluviométrico del 42% y anomalías térmicas de +2.1°C. La región norte de Petén presenta condiciones favorables para el desarrollo agrícola del ciclo actual, mientras que tres nuevos focos de calor fueron detectados en la zona de influencia del Lago de Izabal.',
  stats: {
    sources: 12,
    observations: '2.8 millones',
    events: 41,
    hallazgos: 8,
  },
  generatedAt: new Date().toISOString(),
}

export const COUNTRY_INDICATORS: CountryIndicator[] = [
  { id: 'agri', label: 'Salud Agrícola', score: 62, level: 'NORMAL', change7d: -4, trend: 'down', status: 'warning' },
  { id: 'climate', label: 'Riesgo Climático', score: 44, level: 'ALTO', change7d: -8, trend: 'down', status: 'critical' },
  { id: 'water', label: 'Disponibilidad Hídrica', score: 51, level: 'NORMAL', change7d: -6, trend: 'down', status: 'warning' },
  { id: 'fire', label: 'Actividad de Incendios', score: 78, level: 'ALTO', change7d: 12, trend: 'up', status: 'warning' },
  { id: 'confidence', label: 'Confianza Nacional', score: 91, level: 'NORMAL', change7d: 2, trend: 'stable', status: 'good' },
]

export const TOP_HALLAZGOS: HallazgoExpediente[] = [
  {
    id: 'hal-001',
    codigo: '2026-000143',
    rank: 1,
    titulo: 'Deterioro acelerado del corredor seco',
    descripcion:
      'Reducción significativa del NDVI en 8 departamentos durante las últimas 3 semanas, correlacionada con déficit pluviométrico del 42% y anomalías térmicas de +2.1°C.',
    prioridad: 'critica',
    confianza: 96,
    confianzaNivel: 'high',
    fecha: '9 Jul 2026',
    territorio: 'Corredor Seco',
    evidencias: ['Sentinel-2', 'ERA5', 'CHIRPS', 'NASA FIRMS'],
    hipotesis: 'Estrés hídrico prolongado',
    riesgo: '240,000 ha en zona de riesgo agrícola',
    estrategia: 'Validar en campo y activar protocolo de sequía',
    impactoEsperado: 'Crítico',
    consecuencia: 'Expansión del déficit hídrico a 3 departamentos adicionales en 7 días',
  },
  {
    id: 'hal-002',
    codigo: '2026-000141',
    rank: 2,
    titulo: 'Focos de calor activos en Petén',
    descripcion:
      'NASA FIRMS detectó 3 nuevos focos de calor en los últimos 6 horas. Condiciones de temperatura y humedad favorecen propagación.',
    prioridad: 'alta',
    confianza: 88,
    confianzaNivel: 'high',
    fecha: '9 Jul 2026',
    territorio: 'Petén',
    evidencias: ['NASA FIRMS', 'ERA5', 'Sentinel-2'],
    hipotesis: 'Riesgo elevado de propagación',
    riesgo: '45,000 ha de bosque en perímetro de riesgo',
    estrategia: 'Notificar CONRED y activar monitoreo cada 3h',
    impactoEsperado: 'Alto',
    consecuencia: 'Propagación a 15,000 ha adicionales si persisten condiciones actuales',
  },
  {
    id: 'hal-003',
    codigo: '2026-000138',
    rank: 3,
    titulo: 'Déficit hídrico en cuenca del Motagua',
    descripcion:
      'Precipitación acumulada 38% por debajo de la media histórica en los últimos 30 días. Niveles de humedad del suelo en percentil 12.',
    prioridad: 'alta',
    confianza: 84,
    confianzaNivel: 'high',
    fecha: '9 Jul 2026',
    territorio: 'Izabal / Zacapa',
    evidencias: ['CHIRPS', 'ERA5', 'INSIVUMEH'],
    hipotesis: 'Sequía meteorológica en desarrollo',
    riesgo: 'Abastecimiento hídrico de 12 municipios',
    estrategia: 'Monitoreo intensivo y evaluación de reservas',
    impactoEsperado: 'Alto',
    consecuencia: 'Riesgo de restricción hídrica en 12 municipios en 14 días',
  },
  {
    id: 'hal-004',
    codigo: '2026-000135',
    rank: 4,
    titulo: 'Recuperación vegetativa en Alta Verapaz',
    descripcion:
      'NDVI muestra tendencia positiva del 8% en las últimas 2 semanas. Precipitación dentro de rangos normales para la época.',
    prioridad: 'baja',
    confianza: 79,
    confianzaNivel: 'high',
    fecha: '8 Jul 2026',
    territorio: 'Alta Verapaz',
    evidencias: ['Sentinel-2', 'CHIRPS'],
    hipotesis: 'Recuperación post-período seco',
    riesgo: 'Bajo — condiciones favorables',
    estrategia: 'Continuar monitoreo de rutina',
    impactoEsperado: 'Bajo',
    consecuencia: 'Tendencia positiva — sin impacto adverso proyectado',
  },
  {
    id: 'hal-005',
    codigo: '2026-000132',
    rank: 5,
    titulo: 'Anomalía térmica en costa sur',
    descripcion:
      'Temperaturas +3.2°C sobre media en departamentos de Escuintla y Santa Rosa. Sin correlación con déficit de lluvia.',
    prioridad: 'media',
    confianza: 71,
    confianzaNivel: 'medium',
    fecha: '8 Jul 2026',
    territorio: 'Costa Sur',
    evidencias: ['ERA5', 'OpenMeteo'],
    hipotesis: 'Ola de calor costera',
    riesgo: 'Estrés térmico en cultivos de ciclo corto',
    estrategia: 'Alerta preventiva a productores',
    impactoEsperado: 'Medio',
    consecuencia: 'Reducción estimada del 8-12% en rendimiento de ciclo corto',
  },
]

export const LIVE_TIMELINE: TimelineEntry[] = [
  { id: 'tl-1', time: '06:03', label: 'Sentinel-2 actualizado', source: 'Sentinel', status: 'processed' },
  { id: 'tl-2', time: '06:08', label: 'CHIRPS procesado', source: 'CHIRPS', status: 'processed' },
  { id: 'tl-3', time: '06:10', label: 'NASA FIRMS detectó nuevos focos', source: 'FIRMS', status: 'processed' },
  { id: 'tl-4', time: '06:12', label: 'INSIVUMEH — boletín integrado', source: 'INSIVUMEH', status: 'processed' },
  { id: 'tl-5', time: '06:14', label: 'Reasoning Engine completado', source: 'Motor', status: 'processed' },
  { id: 'tl-6', time: '06:16', label: 'Informe diario generado', source: 'TerraMind', status: 'processed' },
  { id: 'tl-7', time: '06:18', label: 'Procesando ERA5', source: 'ERA5', status: 'analyzing' },
]

export const DATA_SOURCES: DataSource[] = [
  { id: 'sentinel', name: 'Sentinel-2', status: 'connected', lastSync: '06:03', avgLatency: '4.2s', variables: ['NDVI', 'NDMI', 'Nubes'] },
  { id: 'era5', name: 'ERA5', status: 'syncing', lastSync: '06:18', avgLatency: '8.1s', variables: ['Temperatura', 'Precipitación', 'Humedad'] },
  { id: 'chirps', name: 'CHIRPS', status: 'connected', lastSync: '06:08', avgLatency: '3.5s', variables: ['Lluvia diaria', 'Anomalía'] },
  { id: 'firms', name: 'NASA FIRMS', status: 'connected', lastSync: '06:10', avgLatency: '2.1s', variables: ['FRP', 'Focos de calor'] },
  { id: 'insivumeh', name: 'INSIVUMEH', status: 'connected', lastSync: '06:12', avgLatency: '1.8s', variables: ['Boletines', 'Alertas'] },
  { id: 'news', name: 'Noticias', status: 'connected', lastSync: '05:45', avgLatency: '5.0s', variables: ['Artículos', 'Eventos'] },
  { id: 'openmeteo', name: 'OpenMeteo', status: 'connected', lastSync: '06:00', avgLatency: '1.2s', variables: ['Temperatura', 'Viento'] },
  { id: 'openai', name: 'OpenAI', status: 'connected', lastSync: '06:16', avgLatency: '3.8s', variables: ['Narrativa ejecutiva'] },
]

export const SUGGESTED_ACTIONS: SuggestedAction[] = [
  {
    id: 'act-1',
    action: 'Activar protocolo de sequía en corredor seco',
    hallazgoCodigo: '2026-000143',
    horizonte: 'Inmediato',
  },
  {
    id: 'act-2',
    action: 'Coordinar respuesta con CONRED — focos Petén',
    hallazgoCodigo: '2026-000141',
    horizonte: 'Inmediato',
  },
  {
    id: 'act-3',
    action: 'Evaluar reservas hídricas cuenca Motagua',
    hallazgoCodigo: '2026-000138',
    horizonte: '48 horas',
  },
]

export function formatObservationCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toString()
}
