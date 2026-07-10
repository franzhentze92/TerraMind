import { beforeEach, describe, expect, it, vi } from 'vitest'

const listMock = vi.fn()
const activeJobMock = vi.fn()
const insertMock = vi.fn()
const resolveRuntimeMock = vi.fn()

vi.mock('@/pipeline/stores/land-cover.store', () => ({
  listLandCoverEventCandidates: (...args: unknown[]) => listMock(...args),
}))

vi.mock('@/pipeline/stores/land-cover-jobs.store', () => ({
  getActiveLandCoverJobForEvent: (...args: unknown[]) => activeJobMock(...args),
  insertLandCoverJob: (...args: unknown[]) => insertMock(...args),
}))

vi.mock('@/pipeline/engines/fire/context/land-cover.engine', () => ({
  resolveLandCoverRuntime: (...args: unknown[]) => resolveRuntimeMock(...args),
  eventNeedsLandCoverEnrichment: (event: { context_version: string | null }, version: string) =>
    !event.context_version || event.context_version !== version,
  LandCoverSourceUnavailableError: class extends Error {},
}))

import { enqueueLandCoverJobs } from '@/pipeline/engines/fire/context/land-cover-jobs.engine'

describe('enqueueLandCoverJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveRuntimeMock.mockResolvedValue({
      contextVersion: 'v-current',
      radiiM: [500, 1000],
      sourceLayerId: 'layer-1',
    })
    activeJobMock.mockResolvedValue(null)
    insertMock.mockResolvedValue({ created: true, job_id: 'job-1' })
  })

  it('crea job para evento sin contexto', async () => {
    listMock.mockResolvedValue([
      {
        id: 'evt-new',
        status: 'active',
        context_version: null,
        context_generated_at: null,
        last_linked_at: '2026-07-10T10:00:00.000Z',
      },
    ])

    const metrics = await enqueueLandCoverJobs({ limit: 10 })
    expect(metrics.jobs_created).toBe(1)
    expect(insertMock).toHaveBeenCalledTimes(1)
  })

  it('no crea jobs para eventos con contexto vigente', async () => {
    listMock.mockResolvedValue([
      {
        id: 'evt-ok',
        status: 'active',
        context_version: 'v-current',
        context_generated_at: '2026-07-10T10:00:00.000Z',
        last_linked_at: '2026-07-10T09:00:00.000Z',
      },
    ])

    const metrics = await enqueueLandCoverJobs({ limit: 10 })
    expect(metrics.jobs_created).toBe(0)
    expect(metrics.events_unchanged).toBe(1)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('evita job duplicado si ya hay uno activo', async () => {
    listMock.mockResolvedValue([
      {
        id: 'evt-1',
        status: 'active',
        context_version: null,
        context_generated_at: null,
        last_linked_at: null,
      },
    ])
    activeJobMock.mockResolvedValue({ id: 'existing', status: 'pending' })

    const metrics = await enqueueLandCoverJobs({ limit: 10 })
    expect(metrics.jobs_created).toBe(0)
    expect(metrics.jobs_skipped).toBe(1)
    expect(insertMock).not.toHaveBeenCalled()
  })
})
