import { describe, expect, it } from 'vitest'

import { METRIC_REGISTRY } from './metric-registry'
import {
  DATA_CLASSIFICATIONS,
  FORBIDDEN_CLASSIFICATION_VARIANTS,
  METRIC_SCOPES,
  OWNERSHIP_CLASSES,
  TIME_WINDOW_KEYS,
  TIME_WINDOWS,
} from './metric-taxonomy'
import {
  CLASSIFICATION_LABELS,
  OWNERSHIP_LABELS,
  PRODUCT_LANGUAGE,
  SCOPE_LABELS,
  findInternalPhaseCodes,
} from '@/shared/product-language'

describe('metric registry integrity', () => {
  it('every metric declares a valid scope / ownership / time window', () => {
    for (const m of METRIC_REGISTRY) {
      expect(METRIC_SCOPES).toContain(m.scope)
      expect(OWNERSHIP_CLASSES).toContain(m.ownership_policy)
      expect(TIME_WINDOW_KEYS).toContain(m.time_window)
    }
  })

  it('every metric documents a source, unit and last_updated_source', () => {
    for (const m of METRIC_REGISTRY) {
      expect(m.source_table_or_service.length).toBeGreaterThan(0)
      expect(m.unit.length).toBeGreaterThan(0)
      expect(m.last_updated_source.length).toBeGreaterThan(0)
      expect(m.confidence_or_limitations.length).toBeGreaterThan(0)
    }
  })

  it('metric ids are unique', () => {
    const ids = METRIC_REGISTRY.map((m) => m.metric_id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('does not use forbidden classification variants as scope/ownership', () => {
    for (const m of METRIC_REGISTRY) {
      expect(FORBIDDEN_CLASSIFICATION_VARIANTS).not.toContain(m.scope as unknown as string)
      expect(FORBIDDEN_CLASSIFICATION_VARIANTS).not.toContain(m.ownership_policy as unknown as string)
    }
  })
})

describe('taxonomy', () => {
  it('all time windows have labels', () => {
    for (const key of TIME_WINDOW_KEYS) {
      expect(TIME_WINDOWS[key].label.length).toBeGreaterThan(0)
    }
  })

  it('classification set matches labels', () => {
    for (const c of DATA_CLASSIFICATIONS) {
      expect(CLASSIFICATION_LABELS[c]).toBeTruthy()
    }
  })
})

describe('product language', () => {
  it('every scope / classification / ownership has a Spanish label', () => {
    for (const s of METRIC_SCOPES) expect(SCOPE_LABELS[s]).toBeTruthy()
    for (const c of DATA_CLASSIFICATIONS) expect(CLASSIFICATION_LABELS[c]).toBeTruthy()
    for (const o of OWNERSHIP_CLASSES) expect(OWNERSHIP_LABELS[o]).toBeTruthy()
  })

  it('no visible label contains an internal phase code', () => {
    const visible = [
      ...Object.values(PRODUCT_LANGUAGE),
      ...Object.values(SCOPE_LABELS),
      ...Object.values(CLASSIFICATION_LABELS),
      ...Object.values(OWNERSHIP_LABELS),
      ...METRIC_REGISTRY.map((m) => m.label),
    ]
    for (const label of visible) {
      expect(findInternalPhaseCodes(label)).toHaveLength(0)
    }
  })

  it('detects internal phase codes when present', () => {
    expect(findInternalPhaseCodes('Fase 8B.5 lista')).toContain('8B.5')
    expect(findInternalPhaseCodes('8C.1 y 8B.7G')).toEqual(expect.arrayContaining(['8C.1', '8B.7G']))
  })
})
