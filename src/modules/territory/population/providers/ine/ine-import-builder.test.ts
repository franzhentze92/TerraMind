import { describe, expect, it } from 'vitest'

import {
  buildAdminStatisticsRecords,
  runIneImport,
  validateAdminRecords,
} from '@/modules/territory/population/providers/ine/ine-import-builder'
import { INE_NATIONAL_POPULATION_2018 } from '@/modules/territory/population/providers/ine/ine.manifest'
import { INE_NATIONAL_PROJECTION_2020 } from '@/modules/territory/population/providers/ine/ine-projection-2020-reference'

describe('ine-import-builder', () => {
  it('builds 22 department census records', () => {
    const records = buildAdminStatisticsRecords()
    const deptCensus = records.filter((r) => r.adminLevel === 'department' && r.isCensus)
    expect(deptCensus).toHaveLength(22)
  })

  it('sums department census to national total', () => {
    const records = buildAdminStatisticsRecords()
    const warnings = validateAdminRecords(records)
    expect(warnings.some((w) => w.includes('≠ nacional'))).toBe(false)
    const national = records.find((r) => r.adminLevel === 'national' && r.isCensus)
    expect(national?.populationTotal).toBe(INE_NATIONAL_POPULATION_2018)
  })

  it('includes 2020 national projection', () => {
    const records = buildAdminStatisticsRecords()
    const projection = records.find((r) => r.adminLevel === 'national' && r.isProjection)
    expect(projection?.referenceYear).toBe(2020)
    expect(projection?.populationTotal).toBe(INE_NATIONAL_PROJECTION_2020)
  })

  it('rejects duplicate keys in validation', () => {
    const records = buildAdminStatisticsRecords()
    const dup = { ...records[0]! }
    const warnings = validateAdminRecords([...records, dup])
    expect(warnings.some((w) => w.startsWith('Duplicado'))).toBe(true)
  })

  it('dry-run idempotent checksum stable', () => {
    const a = runIneImport('dry-run')
    const b = runIneImport('dry-run')
    expect(a.checksum).toBe(b.checksum)
  })
})
