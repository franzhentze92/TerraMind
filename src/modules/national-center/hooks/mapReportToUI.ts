import {
  DAILY_BRIEF_HEADER,
  EXECUTIVE_BRIEF,
  COUNTRY_INDICATORS,
  TOP_HALLAZGOS,
  LIVE_TIMELINE,
  DATA_SOURCES,
} from '../data/daily-brief.demo'
import type { SituationReport } from '@/pipeline/types'
import type {
  DailyBriefHeader,
  ExecutiveBrief,
  HallazgoExpediente,
  TimelineEntry,
  DataSource,
} from '../data/daily-brief.demo'

export function mapReportToUI(report: SituationReport) {
  const lastUpdated = new Date(report.lastSyncAt)
  const secondsAgo = Math.floor((Date.now() - lastUpdated.getTime()) / 1000)

  const header: DailyBriefHeader = {
    countryName: 'Guatemala',
    countryCode: 'GT',
    eventsToday: report.eventsCount,
    lastUpdatedSecondsAgo: secondsAgo,
    systemStatus: report.systemStatus,
    sourcesActive: report.sourcesActive,
    observationsToday: report.observationsCount,
    hallazgosToday: report.hallazgosCount,
    nationalConfidence: report.nationalConfidence,
  }

  const executiveBrief: ExecutiveBrief = {
    greeting: report.executiveBrief.greeting,
    situacionesPrioritarias: report.executiveBrief.situacionesPrioritarias,
    criticas: report.executiveBrief.criticas,
    atencion: report.executiveBrief.atencion,
    positivos: report.executiveBrief.positivos,
    fullAnalysis: report.executiveBrief.fullAnalysis,
    stats: report.executiveBrief.stats,
    generatedAt: report.generatedAt,
  }

  const hallazgos: HallazgoExpediente[] = report.hallazgos.map((h) => ({
    id: h.id,
    codigo: h.codigo,
    rank: h.rank,
    titulo: h.titulo,
    descripcion: h.descripcion,
    prioridad: h.prioridad,
    confianza: h.confianza,
    confianzaNivel: h.confianzaNivel,
    fecha: h.fecha,
    territorio: h.territorio,
    evidencias: h.evidencias,
    hipotesis: h.hipotesis,
    riesgo: h.riesgo,
    estrategia: h.estrategia,
    impactoEsperado: h.impactoEsperado,
    consecuencia: h.consecuencia,
  }))

  const timeline: TimelineEntry[] = report.timeline.map((t) => ({
    id: t.id,
    time: new Date(t.time).toLocaleTimeString('es-GT', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    label: t.label,
    source: t.source,
    status: t.status,
  }))

  const sources: DataSource[] = report.sources.map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
    lastSync: s.lastSync
      ? new Date(s.lastSync).toLocaleTimeString('es-GT', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : undefined,
    avgLatency: s.avgLatency,
    variables: s.variables,
  }))

  return { header, executiveBrief, hallazgos, timeline, sources, lastUpdated }
}

export const DEMO_UI = {
  header: DAILY_BRIEF_HEADER,
  executiveBrief: EXECUTIVE_BRIEF,
  indicators: COUNTRY_INDICATORS,
  hallazgos: TOP_HALLAZGOS,
  timeline: LIVE_TIMELINE,
  sources: DATA_SOURCES,
}
