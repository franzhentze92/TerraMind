import type {
  ExecutiveBriefReport,
  SituationReport,
  SourceStatus,
  TerraMindStore,
  TimelineRecord,
} from '@/pipeline/types'

/**
 * Situation Report Engine — informe de ingesta (Sprint 1).
 */
export function buildSituationReport(store: TerraMindStore): SituationReport {
  const now = new Date()
  const lastSync = store.lastSyncAt ? new Date(store.lastSyncAt) : now
  const nextSync = new Date(lastSync.getTime() + 3_600_000)

  const hour = now.getHours()
  const greeting =
    hour < 12 ? 'Buenos días.' : hour < 18 ? 'Buenas tardes.' : 'Buenas noches.'

  const executiveBrief: ExecutiveBriefReport = {
    greeting,
    situacionesPrioritarias: 0,
    criticas: [],
    atencion: [],
    positivos: [],
    fullAnalysis: buildIngestionAnalysis(store),
    stats: {
      sources: store.firmsHealth.status === 'connected' ? 1 : 0,
      observations: formatCount(store.observations.length),
      events: 0,
      hallazgos: 0,
    },
  }

  const firmsStatus = mapFirmsSourceStatus(store.firmsHealth, store.lastRun)

  const sources: SourceStatus[] = [
    {
      id: 'nasa-firms',
      name: 'NASA FIRMS',
      status: firmsStatus,
      lastSync: store.firmsHealth.lastSuccessfulSyncAt ?? store.lastSyncAt,
      avgLatency: store.firmsHealth.latencyMs
        ? `${store.firmsHealth.latencyMs}ms`
        : undefined,
      variables: [
        'fire_radiative_power',
        'bright_ti4',
        'confidence',
        'daynight',
      ],
      detectionsCount: store.observations.length,
    },
  ]

  const systemStatus =
    firmsStatus === 'connected'
      ? 'operational'
      : firmsStatus === 'degraded' || store.observations.length > 0
        ? 'degraded'
        : 'processing'

  return {
    generatedAt: now.toISOString(),
    lastSyncAt: store.lastSyncAt ?? now.toISOString(),
    nextSyncAt: nextSync.toISOString(),
    systemStatus,
    sourcesActive: firmsStatus === 'connected' ? 1 : 0,
    observationsCount: store.observations.length,
    eventsCount: 0,
    hallazgosCount: 0,
    nationalConfidence: 0,
    executiveBrief,
    hallazgos: [],
    timeline: store.timeline.slice(0, 20),
    sources,
  }
}

function mapFirmsSourceStatus(
  health: TerraMindStore['firmsHealth'],
  lastRun?: TerraMindStore['lastRun'],
): SourceStatus['status'] {
  if (health.status === 'syncing') return 'syncing'
  if (health.status === 'connected') return 'connected'
  if (health.status === 'degraded') return 'degraded'
  if (health.status === 'offline' || health.status === 'unconfigured') {
    return lastRun?.errors.length && health.lastSuccessfulSyncAt ? 'degraded' : 'offline'
  }
  return 'offline'
}

function buildIngestionAnalysis(store: TerraMindStore): string {
  const count = store.observations.length
  const health = store.firmsHealth

  if (health.status === 'unconfigured') {
    return (
      'TerraMind está listo para conectar con NASA FIRMS. ' +
      'Configure NASA_FIRMS_MAP_KEY en el servidor para iniciar la ingesta automática de focos de calor.'
    )
  }

  if (health.status === 'degraded' || (lastRunHasErrors(store) && count > 0)) {
    return (
      `TerraMind conserva ${count} detecciones de focos de calor de la última sincronización exitosa. ` +
      'La fuente NASA FIRMS está en estado degradado. El sistema reintentará automáticamente.'
    )
  }

  if (count === 0) {
    return (
      'NASA FIRMS sincronizado correctamente. No se detectaron focos de calor en Guatemala en las últimas 24 horas. ' +
      'TerraMind continúa observando automáticamente.'
    )
  }

  return (
    `TerraMind detectó ${count} foco(s) de calor en Guatemala (VIIRS, últimas 24h). ` +
    'Cada detección es una anomalía térmica satelital — no confirma un incendio forestal. ' +
    'El motor de hallazgos se activará en el siguiente sprint.'
  )
}

function lastRunHasErrors(store: TerraMindStore): boolean {
  return (store.lastRun?.errors.length ?? 0) > 0
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function createTimelineEntry(
  label: string,
  source?: string,
  status: TimelineRecord['status'] = 'processed',
): TimelineRecord {
  return {
    id: `tl:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
    time: new Date().toISOString(),
    label,
    source,
    status,
  }
}
