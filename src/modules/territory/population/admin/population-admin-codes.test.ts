import { describe, expect, it } from 'vitest'

import {
  adm1PcodeToDepartmentCode,
  adm2PcodeToMunicipalityCode,
  departmentCodeToAdm1Pcode,
  inferDepartmentFromMunicipalityCode,
  normalizeAdminName,
} from '@/modules/territory/population/admin/population-admin-codes'

describe('population-admin-codes', () => {
  it('normalizes GT01 ↔ 01', () => {
    expect(adm1PcodeToDepartmentCode('GT01')).toBe('01')
    expect(departmentCodeToAdm1Pcode('1')).toBe('GT01')
  })

  it('normalizes municipality pcode', () => {
    expect(adm2PcodeToMunicipalityCode('GT1301')).toBe('1301')
    expect(inferDepartmentFromMunicipalityCode('1301')).toBe('13')
  })

  it('strips accents in names', () => {
    expect(normalizeAdminName('Quetzaltenango')).toBe('quetzaltenango')
  })
})
