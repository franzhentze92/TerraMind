import { describe, expect, it, vi } from 'vitest'

vi.mock('@/modules/territory/population/population.service', () => ({
  createPopulationService: vi.fn(() => ({
    analyzeBuffers: vi.fn().mockRejectedValue(new Error('no raster in test')),
    samplePoint: vi.fn().mockRejectedValue(new Error('no raster in test')),
  })),
}))

import { auditRuralHuehuetenango } from '@/modules/territory/population/audit/rural-huehuetenango-audit'

describe('rural Huehuetenango audit', () => {
  it('includes official department context and nearest settlements', async () => {
    const audit = await auditRuralHuehuetenango()
    expect(audit.departmentOfficial?.code).toBe('13')
    expect(audit.nearestSettlements.length).toBeGreaterThan(0)
    expect(audit.analysis.bufferVsMunicipalTotalWarning).toContain('No comparar')
    expect([
      'plausible',
      'requires_caution',
      'misclassified_point',
      'possible_artificial_concentration',
      'pending_missing_source',
    ]).toContain(audit.conclusion)
  })
})
