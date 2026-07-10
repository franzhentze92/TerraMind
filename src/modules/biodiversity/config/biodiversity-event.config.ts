function readInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export const BIODIVERSITY_EVENT_RADII_M = [1000, 3000, 5000, 10_000] as const

export const BIODIVERSITY_EVENT_CONFIG = {
  radiiM: [...BIODIVERSITY_EVENT_RADII_M],
  historyYears: readInt('BIODIVERSITY_CONTEXT_HISTORY_YEARS', 5),
  recentDays: readInt('BIODIVERSITY_CONTEXT_RECENT_DAYS', 30),
  recentDays90: 90,
  eventWindowDays: readInt('BIODIVERSITY_CONTEXT_EVENT_WINDOW_DAYS', 30),
  maxFetchRecords: readInt('BIODIVERSITY_MAX_SEARCH_RECORDS', 500),
  visualHighlightLimit: 6,
  monitoredZoneNearFactor: 1.25,
  disclaimer:
    'Los registros reflejan biodiversidad documentada por las fuentes consultadas y esfuerzo de observación. No constituyen un inventario completo ni confirman presencia o afectación en el momento del evento.',
} as const
