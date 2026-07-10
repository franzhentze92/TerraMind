import type { Evento } from '@/ontology/entities/evento'
import type { Evidencia } from '@/ontology/entities/evidencia'
import type { Expediente } from '@/ontology/entities/expediente'
import type { Hallazgo } from '@/ontology/entities/hallazgo'
import type { Hipotesis } from '@/ontology/entities/hipotesis'
import type { Observacion } from '@/ontology/entities/observacion'
import type { Prioridad } from '@/ontology/entities/prioridad'
import type { Riesgo } from '@/ontology/entities/riesgo'
import type { Estrategia } from '@/ontology/entities/estrategia'
import type { ISODateTime } from '@/ontology/primitives'

export interface PipelineRunResult {
  runId: string
  startedAt: ISODateTime
  completedAt: ISODateTime
  observationsIngested: number
  eventsCreated: number
  hallazgosCreated: number
  hallazgosUpdated: number
  source: string
  errors: string[]
  detectionsFetched: number
  detectionsTotal: number
}

export interface TimelineRecord {
  id: string
  time: ISODateTime
  label: string
  source?: string
  status: 'processed' | 'analyzing' | 'waiting'
}

export interface SituationReport {
  generatedAt: ISODateTime
  lastSyncAt: ISODateTime
  nextSyncAt: ISODateTime
  systemStatus: 'operational' | 'degraded' | 'processing'
  sourcesActive: number
  observationsCount: number
  eventsCount: number
  hallazgosCount: number
  nationalConfidence: number
  executiveBrief: ExecutiveBriefReport
  hallazgos: HallazgoReport[]
  timeline: TimelineRecord[]
  sources: SourceStatus[]
}

export interface ExecutiveBriefReport {
  greeting: string
  situacionesPrioritarias: number
  criticas: BriefItem[]
  atencion: BriefItem[]
  positivos: BriefItem[]
  fullAnalysis: string
  stats: {
    sources: number
    observations: string
    events: number
    hallazgos: number
  }
}

export interface BriefItem {
  id: string
  titulo: string
  prioridad: 'critica' | 'atencion' | 'positivo'
}

export type HallazgoReportConfianzaNivel = 'high' | 'medium' | 'low' | 'insufficient'

export interface HallazgoReport {
  id: string
  codigo: string
  rank: number
  titulo: string
  descripcion: string
  prioridad: 'critica' | 'alta' | 'media' | 'baja'
  confianza: number
  confianzaNivel: HallazgoReportConfianzaNivel
  fecha: string
  territorio: string
  evidencias: string[]
  hipotesis: string
  riesgo: string
  estrategia: string
  impactoEsperado: 'Bajo' | 'Medio' | 'Alto' | 'Crítico'
  consecuencia: string
}

export interface SourceStatus {
  id: string
  name: string
  status: 'connected' | 'syncing' | 'offline' | 'degraded'
  lastSync?: string
  avgLatency?: string
  variables: string[]
  detectionsCount?: number
}

export type FirmsHealthStatus =
  | 'connected'
  | 'degraded'
  | 'offline'
  | 'unconfigured'
  | 'syncing'

export interface FirmsHealth {
  status: FirmsHealthStatus
  lastError?: string
  lastSuccessfulSyncAt?: ISODateTime
  detectionsLastSync?: number
  latencyMs?: number
}

export interface TerraMindStore {
  observations: Observacion[]
  eventos: Evento[]
  hallazgos: Hallazgo[]
  expedientes: Expediente[]
  hipotesis: Hipotesis[]
  evidencias: Evidencia[]
  prioridades: Prioridad[]
  riesgos: Riesgo[]
  estrategias: Estrategia[]
  timeline: TimelineRecord[]
  lastSyncAt?: ISODateTime
  lastRun?: PipelineRunResult
  hallazgoSequence: number
  firmsHealth: FirmsHealth
}
