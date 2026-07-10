import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildLandCoverContextVersion } from '@/modules/territory/land-cover/land-cover-context-version'

const listMock = vi.fn()
const fetchDetectionsMock = vi.fn()
const persistMock = vi.fn()
const getLayerIdMock = vi.fn()
const analyzeBuffersMock = vi.fn()
const getSourceStatusMock = vi.fn()

vi.mock('@/pipeline/stores/land-cover.store', () => ({
  listLandCoverEventCandidates: (...args: unknown[]) => listMock(...args),
  fetchEventDetections: (...args: unknown[]) => fetchDetectionsMock(...args),
  persistLandCoverAnalysis: (...args: unknown[]) => persistMock(...args),
  getTerritorialLayerId: (...args: unknown[]) => getLayerIdMock(...args),
}))

vi.mock('@/modules/territory/land-cover/land-cover.service', () => ({
  createLandCoverService: () => ({
    getSourceStatus: getSourceStatusMock,
    analyzeBuffers: analyzeBuffersMock,
  }),
}))

import { runLandCoverEnrichment } from '@/pipeline/engines/fire/context/land-cover.engine'

const RASTER_HASH = 'a'.repeat(64)
const CURRENT_VERSION = buildLandCoverContextVersion({
  sourceVersion: '2021-v200',
  rasterHash: RASTER_HASH,
  mapperVersion: 'esa-worldcover-v200-mapper-v1',
  analysisMethodVersion: 'laea-zone-stats-v1',
  zoneRadiiM: [500, 1000],
})

describe('land-cover engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSourceStatusMock.mockResolvedValue({
      available: true,
      sourceVersion: '2021-v200',
      analyticCogSha256: RASTER_HASH,
      mapperVersion: 'esa-worldcover-v200-mapper-v1',
      analysisMethodVersion: 'laea-zone-stats-v1',
    })
    getLayerIdMock.mockResolvedValue('layer-uuid')
    listMock.mockResolvedValue([
      {
        id: 'evt-1',
        department_name: 'Petén',
        status: 'active',
        detection_count: 2,
        centroid_lat: 16.9,
        centroid_lng: -90.5,
        last_linked_at: '2026-07-10T08:00:00.000Z',
        context_version: CURRENT_VERSION,
        context_generated_at: '2026-07-10T09:00:00.000Z',
      },
    ])
    fetchDetectionsMock.mockResolvedValue([
      { id: 'd1', latitude: 16.9, longitude: -90.5 },
    ])
    analyzeBuffersMock.mockResolvedValue({
      sourceVersion: '2021-v200',
      sourceYear: 2021,
      contextVersion: CURRENT_VERSION,
      status: 'complete',
      warnings: ['outdated_source_year'],
      generatedAt: '2026-07-10T10:00:00.000Z',
      pointDistribution: { dominantClass: 'forest', classDistribution: [], validPixelCount: 1, nodataPixelCount: 0, dataCoveragePct: 100, analyzedAreaHa: 0 },
      pointSamples: [],
      zones: [
        {
          radiusM: 500,
          geometryMethod: 'unified_buffer_union',
          distribution: {
            dominantClass: 'forest',
            classDistribution: [],
            validPixelCount: 100,
            nodataPixelCount: 0,
            dataCoveragePct: 100,
            analyzedAreaHa: 78,
          },
        },
      ],
    })
  })

  it('deja eventos sin cambios cuando el contexto está vigente', async () => {
    const metrics = await runLandCoverEnrichment({ limit: 10, force: false })
    expect(metrics.events_considered).toBe(1)
    expect(metrics.events_enriched).toBe(0)
    expect(metrics.events_unchanged).toBe(1)
    expect(persistMock).not.toHaveBeenCalled()
  })

  it('enriquece con --force y persiste', async () => {
    const metrics = await runLandCoverEnrichment({ limit: 10, force: true })
    expect(metrics.events_enriched).toBe(1)
    expect(persistMock).toHaveBeenCalledTimes(1)
  })

  it('usa centroide cuando no hay detecciones vinculadas', async () => {
    listMock.mockResolvedValue([
      {
        id: 'evt-2',
        department_name: 'Petén',
        status: 'active',
        detection_count: 0,
        centroid_lat: 16.9,
        centroid_lng: -90.5,
        last_linked_at: null,
        context_version: null,
        context_generated_at: null,
      },
    ])
    fetchDetectionsMock.mockResolvedValue([])

    const metrics = await runLandCoverEnrichment({ limit: 10, force: true })
    expect(metrics.events_enriched).toBe(1)
    expect(metrics.centroid_fallback_count).toBe(1)
    expect(analyzeBuffersMock).toHaveBeenCalledWith(
      expect.objectContaining({
        points: [{ lat: 16.9, lon: -90.5, id: 'centroid' }],
      }),
    )
  })

  it('no borra contexto previo si falla el análisis', async () => {
    listMock.mockResolvedValue([
      {
        id: 'evt-3',
        department_name: 'Petén',
        status: 'active',
        detection_count: 1,
        centroid_lat: 16.9,
        centroid_lng: -90.5,
        last_linked_at: null,
        context_version: null,
        context_generated_at: null,
      },
    ])
    analyzeBuffersMock.mockRejectedValue(new Error('GDAL falló'))

    const metrics = await runLandCoverEnrichment({ limit: 10, force: true })
    expect(metrics.events_failed).toBe(1)
    expect(persistMock).not.toHaveBeenCalled()
  })
})
