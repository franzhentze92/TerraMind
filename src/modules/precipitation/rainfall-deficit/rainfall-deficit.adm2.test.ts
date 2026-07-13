/**
 * Tests — ADM2 entity classification (340 municipalities + 2 lakes = 342).
 *
 * Section 16: resolve the 342 vs 340 discrepancy. Municipal counts must exclude
 * lakes; spatial operations may keep lake geometry; public UI must never claim
 * "342 municipios".
 */
import { describe, expect, it } from 'vitest'
import {
  ADM2_LAKE_PCODES,
  GUATEMALA_MUNICIPALITY_COUNT,
  classifyAdm2Entity,
  loadAdm2Entities,
  loadAdm2Lakes,
  loadMunicipalities,
} from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.municipal'

describe('ADM2 entity classification', () => {
  const entities = loadAdm2Entities()
  const municipalities = loadMunicipalities()
  const lakes = loadAdm2Lakes()

  it('has 342 total ADM2 geometries', () => {
    expect(entities.length).toBe(342)
  })

  it('classifies exactly 340 municipalities', () => {
    expect(municipalities.length).toBe(340)
    expect(GUATEMALA_MUNICIPALITY_COUNT).toBe(340)
    expect(municipalities.every((m) => m.entityType === 'municipality')).toBe(true)
  })

  it('classifies exactly 2 lakes with documented pcodes and names', () => {
    expect(lakes.length).toBe(2)
    expect(lakes.map((l) => l.pcode).sort()).toEqual([...ADM2_LAKE_PCODES].sort())
    const names = lakes.map((l) => l.name.toLowerCase())
    expect(names.some((n) => n.includes('amatitlan'))).toBe(true)
    expect(names.some((n) => n.includes('atitlan'))).toBe(true)
    expect(lakes.every((l) => l.entityType === 'lake')).toBe(true)
  })

  it('municipalities + lakes reconcile to the full 342', () => {
    expect(municipalities.length + lakes.length).toBe(entities.length)
  })

  it('municipal calculation excludes lakes (no lake pcode among municipalities)', () => {
    const municipalPcodes = new Set(municipalities.map((m) => m.pcode))
    for (const lakePcode of ADM2_LAKE_PCODES) {
      expect(municipalPcodes.has(lakePcode)).toBe(false)
    }
  })

  it('preserves lake geometry for spatial operations', () => {
    for (const lake of lakes) {
      expect(lake.polygons.length).toBeGreaterThan(0)
      expect(lake.polygons[0]!.length).toBeGreaterThan(0)
      expect(lake.areaKm2).toBeGreaterThan(0)
    }
  })

  it('does not misclassify the real municipality Amatitlán as a lake', () => {
    // Municipality Amatitlán is GT0114; the lake is GT0100.
    const amatitlanMuni = municipalities.find((m) => m.pcode === 'GT0114')
    expect(amatitlanMuni).toBeDefined()
    expect(amatitlanMuni!.entityType).toBe('municipality')
  })

  it('classifyAdm2Entity rules', () => {
    expect(classifyAdm2Entity('GT0100', 'Lago De Amatitlan')).toBe('lake')
    expect(classifyAdm2Entity('GT0700', 'Lago De Atitlan')).toBe('lake')
    expect(classifyAdm2Entity('GT0114', 'Amatitlán')).toBe('municipality')
    expect(classifyAdm2Entity('GT1802', 'Lívingston')).toBe('municipality')
  })
})
