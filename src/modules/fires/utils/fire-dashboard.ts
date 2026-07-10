import type { FireSummaryDto } from '@/modules/fires/types/fire.dto'
import type {
  CountryIndicator,
  ExecutiveBrief,
  TimelineEntry,
} from '@/modules/national-center/data/daily-brief.demo'
import { formatGuatemalaTime, riskLevelLabel } from '@/modules/fires/utils/format'

export interface FireDashboardHeader {
  countryName: string
  countryCode: string
  systemStatus: 'operational' | 'degraded' | 'processing'
  sourcesQueriedLabel: string
  detectionsNational: number
  eventsThermal: number
  attentionCount: number
  firmsIngestionLabel: string | null
  uiRefreshAt: Date
}

export function buildFireDashboardHeader(summary: FireSummaryDto): FireDashboardHeader {
  const ds = summary.data_status
  const firmsMinutes = ds.last_firms_ingestion_at
    ? formatRelativeShort(ds.last_firms_ingestion_at)
    : null

  return {
    countryName: 'Guatemala',
    countryCode: 'GT',
    systemStatus: ds.is_stale || ds.is_partial ? 'degraded' : 'operational',
    sourcesQueriedLabel: `${ds.sources_queried_successfully}/${ds.sources_expected}`,
    detectionsNational: summary.detections_count,
    eventsThermal: summary.events_count,
    attentionCount: summary.attention_events_count,
    firmsIngestionLabel: firmsMinutes,
    uiRefreshAt: new Date(summary.generated_at),
  }
}

export function buildFireExecutiveBrief(summary: FireSummaryDto): ExecutiveBrief {
  const ds = summary.data_status
  const highlight = summary.highest_priority_event
  const window = summary.window_hours

  let priorityIntro: string
  if (summary.attention_events_count > 0) {
    priorityIntro = `Hoy TerraMind identificó ${summary.attention_events_count} situación${
      summary.attention_events_count === 1 ? '' : 'es'
    } prioritaria${summary.attention_events_count === 1 ? '' : 's'}.`
  } else {
    priorityIntro = 'No se identificaron situaciones prioritarias.'
  }

  let fullAnalysis: string
  if (summary.events_count === 0) {
    fullAnalysis =
      `TerraMind no identificó eventos térmicos en Guatemala durante las últimas ${window} horas. ` +
      `Se analizaron ${summary.observations_downloaded} observaciones FIRMS descargadas, ` +
      `de las cuales ${summary.detections_count} detecciones quedaron dentro del territorio nacional.`
  } else {
    fullAnalysis =
      `TerraMind identificó ${summary.events_count} evento${
        summary.events_count === 1 ? '' : 's'
      } térmico${summary.events_count === 1 ? '' : 's'} en Guatemala durante las últimas ${window} horas, ` +
      `basados en ${summary.detections_count} ${
        summary.detections_count === 1 ? 'detección satelital' : 'detecciones satelitales'
      }.`

    if (highlight && summary.attention_events_count > 0) {
      fullAnalysis +=
        ` Un evento en ${highlight.department ?? 'territorio nacional'} requiere atención` +
        (highlight.satellite_count >= 2
          ? ` por haber sido observado por ${highlight.satellite_count} satélites.`
          : '.')
    } else if (summary.events_count > 0) {
      fullAnalysis +=
        ' Los eventos permanecen en observación o como detecciones no validadas.'
    }
  }

  if (ds.is_partial) {
    fullAnalysis +=
      ` La última ingesta FIRMS fue parcial: ${ds.sources_failed} fuente${
        ds.sources_failed === 1 ? '' : 's'
      } no respondió correctamente.`
  } else if (ds.sources_queried_successfully === ds.sources_expected) {
    fullAnalysis += ` Las ${ds.sources_expected} fuentes satelitales consultadas respondieron correctamente.`
  }

  if (ds.sources_with_detections < ds.sources_queried_successfully) {
    fullAnalysis +=
      ` Detecciones nacionales provenientes de ${ds.sources_with_detections} de ${ds.sources_queried_successfully} fuentes operativas.`
  }

  if (ds.is_stale) {
    fullAnalysis += ' Los datos satelitales pueden estar desactualizados.'
  }

  const atencion =
    highlight && summary.attention_events_count > 0
      ? [
          {
            id: highlight.id,
            titulo: `${highlight.department ?? 'Evento térmico'} — ${riskLevelLabel(highlight.risk_level)}`,
            prioridad: 'atencion' as const,
          },
        ]
      : []

  return {
    greeting: 'Buenos días.',
    situacionesPrioritarias: summary.attention_events_count,
    criticas: [],
    atencion,
    positivos: [],
    fullAnalysis,
    stats: {
      sources: `${ds.sources_queried_successfully}/${ds.sources_expected}`,
      observations: String(summary.observations_downloaded),
      detectionsNational: summary.detections_count,
      events: summary.events_count,
      attention: summary.attention_events_count,
    },
    generatedAt: summary.generated_at,
    priorityIntro,
    isLive: true,
  }
}

export function buildFireTimeline(summary: FireSummaryDto): TimelineEntry[] {
  const ds = summary.data_status
  const time = summary.data_status.last_successful_ingestion_at
    ? formatGuatemalaTime(summary.data_status.last_successful_ingestion_at)
    : formatGuatemalaTime(summary.generated_at)

  const entries: TimelineEntry[] = [
    {
      id: 'fire-tl-ingest',
      time,
      label: `${summary.observations_downloaded} observaciones FIRMS recibidas de ${ds.sources_queried_successfully} productos`,
      source: 'FIRMS',
      status: ds.sources_failed > 0 ? 'analyzing' : 'processed',
    },
    {
      id: 'fire-tl-geo',
      time,
      label: `${summary.detections_count} detecciones clasificadas dentro de Guatemala · ${summary.detections_outside_count} fuera de la vista nacional`,
      source: 'Geografía',
      status: 'processed',
    },
    {
      id: 'fire-tl-events',
      time,
      label: `${summary.detections_count} detecciones agrupadas en ${summary.events_count} evento${
        summary.events_count === 1 ? '' : 's'
      } térmico${summary.events_count === 1 ? '' : 's'}`,
      source: 'Eventos',
      status: 'processed',
    },
  ]

  if (summary.highest_priority_event && summary.attention_events_count > 0) {
    const h = summary.highest_priority_event
    entries.push({
      id: 'fire-tl-priority',
      time,
      label: `${h.department ?? 'Evento'} clasificado como ${riskLevelLabel(h.risk_level)} · ${h.satellite_count} satélite${h.satellite_count === 1 ? '' : 's'}`,
      source: 'Prioridad',
      status: 'processed',
    })
  }

  entries.push({
    id: 'fire-tl-sources',
    time,
    label:
      ds.is_partial
        ? `${ds.sources_failed} fuente${ds.sources_failed === 1 ? '' : 's'} fallida${ds.sources_failed === 1 ? '' : 's'} · ${ds.sources_queried_successfully}/${ds.sources_expected} operativas`
        : `${ds.sources_queried_successfully}/${ds.sources_expected} fuentes operativas · detecciones de ${ds.sources_with_detections} satélite${ds.sources_with_detections === 1 ? '' : 's'}`,
    source: 'Datos',
    status: ds.is_partial ? 'analyzing' : 'processed',
  })

  return entries
}

export function buildFireThermalIndicator(summary: FireSummaryDto): CountryIndicator {
  return {
    id: 'fire',
    label: 'Actividad térmica',
    score: summary.events_count,
    level: summary.attention_events_count > 0 ? 'ALTO' : summary.events_count > 0 ? 'NORMAL' : 'BAJO',
    change7d: summary.attention_events_count,
    trend: summary.attention_events_count > 0 ? 'up' : 'stable',
    status: summary.attention_events_count > 0 ? 'warning' : 'good',
    subtitle: `últimas ${summary.window_hours} h`,
    contextLabel:
      summary.attention_events_count > 0
        ? `${summary.attention_events_count} atención`
        : 'sin prioridad',
  }
}

export function buildFireReasoningSteps(summary: FireSummaryDto): string[] {
  const ds = summary.data_status
  const steps = [
    'TerraMind está razonando…',
    `FIRMS: ${summary.observations_downloaded} observaciones de ${ds.sources_queried_successfully}/${ds.sources_expected} fuentes`,
    `Geografía: ${summary.detections_count} detecciones nacionales`,
    `Eventos: ${summary.events_count} térmicos agrupados`,
  ]
  if (summary.attention_events_count > 0 && summary.highest_priority_event) {
    steps.push(
      `Prioridad: ${summary.highest_priority_event.department ?? 'evento'} en ${riskLevelLabel(summary.highest_priority_event.risk_level)}`,
    )
  }
  steps.push('Resumen nacional actualizado')
  return steps
}

function formatRelativeShort(isoUtc: string): string {
  const diffMs = Date.now() - new Date(isoUtc).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `${hours} h`
}
