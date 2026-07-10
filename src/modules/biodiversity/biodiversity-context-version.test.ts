import { describe, expect, it } from 'vitest'

import { buildBiodiversityContextVersion } from './biodiversity-context-version'
import { BIODIVERSITY_EVENT_CONFIG } from './config/biodiversity-event.config'

describe('biodiversity-context-version', () => {
  it('is deterministic for same inputs', () => {
    const a = buildBiodiversityContextVersion({
      radiiM: [...BIODIVERSITY_EVENT_CONFIG.radiiM],
      historyYears: 5,
    })
    const b = buildBiodiversityContextVersion({
      radiiM: [...BIODIVERSITY_EVENT_CONFIG.radiiM],
      historyYears: 5,
    })
    expect(a).toBe(b)
    expect(a).toHaveLength(16)
  })

  it('changes when radii change', () => {
    const a = buildBiodiversityContextVersion({ radiiM: [1000, 3000] })
    const b = buildBiodiversityContextVersion({ radiiM: [1000, 5000] })
    expect(a).not.toBe(b)
  })
})
