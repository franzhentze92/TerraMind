function readInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function readFloat(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export const BIODIVERSITY_CONFIG = {
  userAgent:
    process.env.BIODIVERSITY_USER_AGENT?.trim() ||
    'TerraMind-Biodiversity/1.0 (+https://terramind.gt; contact=dev@terramind.gt)',
  requestTimeoutMs: readInt('BIODIVERSITY_REQUEST_TIMEOUT_MS', 20_000),
  maxConcurrency: readInt('BIODIVERSITY_MAX_CONCURRENCY', 3),
  maxRadiusM: 50_000,
  maxLimit: 200,
  maxGeometryVertices: 64,
  maxSearchRecordsPerQuery: readInt('BIODIVERSITY_MAX_SEARCH_RECORDS', 500),
  cache: {
    gbifSearchTtlHours: readFloat('GBIF_SEARCH_TTL_HOURS', 24),
    inaturalistSearchTtlHours: readFloat('INATURALIST_SEARCH_TTL_HOURS', 2),
    taxonTtlDays: readFloat('BIODIVERSITY_TAXON_TTL_DAYS', 7),
    healthTtlMinutes: readFloat('BIODIVERSITY_HEALTH_TTL_MINUTES', 15),
  },
  gbif: {
    baseUrl: 'https://api.gbif.org',
    maxPageSize: 300,
    maxOffset: 100_000,
  },
  inaturalist: {
    baseUrl: 'https://api.inaturalist.org/v1',
    maxPageSize: 200,
    maxPage: 500,
    /** iNaturalist dataset key in GBIF for cross-reference. */
    gbifDatasetKey: '50c9509d-22c7-4a22-a47d-8c48425ef4a7',
  },
  disclaimer:
    'Los registros reflejan observaciones y colecciones reportadas, no población actual, abundancia ni ausencia de especies. Pocas observaciones pueden indicar bajo esfuerzo de muestreo.',
} as const
