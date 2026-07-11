/**
 * Synthetic framework test plugin — self-test.
 *
 * Proves that a brand-new plugin is auto-detected end to end WITHOUT editing any
 * central module: registry, catalogs (report + map renderer), presentation,
 * finding-rule registry, priority provider and a National-Situation-style
 * summary all pick it up from the single manifest. It also proves the type is
 * NEVER enabled in normal runtime.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ensureEventsRegistered } from '@/modules/environmental-events/registry/register-all'
import { environmentalEventRegistry } from '@/modules/environmental-events/registry/event-type-registry'
import { serverEventRegistry } from '@/modules/environmental-events/registry/server-event-registry'
import { syntheticFixtures, syntheticRepository } from './event.repository'
import { SYNTHETIC_RULE_ID } from './event.finding-rules'
import { syntheticPresentationAdapter } from './event.presentation'

const TYPE = 'synthetic_framework_test'

beforeAll(() => {
  ensureEventsRegistered()
  serverEventRegistry.register({ type: TYPE, repository: syntheticRepository })
})

afterAll(() => {
  environmentalEventRegistry.setIncludeDisabled(false)
})

describe('synthetic framework test plugin', () => {
  it('is NEVER enabled in normal runtime', () => {
    environmentalEventRegistry.setIncludeDisabled(false)
    expect(environmentalEventRegistry.isEnabled(TYPE)).toBe(false)
    expect(environmentalEventRegistry.enabledTypes()).not.toContain(TYPE)
  })

  it('is auto-registered structurally (no central edits)', () => {
    expect(environmentalEventRegistry.has(TYPE)).toBe(true)
    const manifest = environmentalEventRegistry.get(TYPE)
    expect(manifest.type).toBe(TYPE)
    expect(manifest.presentation.eventType).toBe(TYPE)
    expect(manifest.mapRenderer.eventType).toBe(TYPE)
    expect(manifest.priorityProvider.eventType).toBe(TYPE)
    expect(manifest.reportAdapter.eventType).toBe(TYPE)
  })

  describe('with the test flag on', () => {
    beforeAll(() => environmentalEventRegistry.setIncludeDisabled(true))

    it('appears in enabled types (API /types equivalent)', () => {
      expect(environmentalEventRegistry.enabledTypes()).toContain(TYPE)
    })

    it('appears in the report adapter catalog', () => {
      const catalog = environmentalEventRegistry.reportAdapterCatalog()
      expect(catalog.some((a) => a.eventType === TYPE)).toBe(true)
    })

    it('appears in the map renderer catalog and validates its geometry', () => {
      const catalog = environmentalEventRegistry.mapRendererCatalog()
      const renderer = catalog.find((r) => r.eventType === TYPE)
      expect(renderer).toBeDefined()
      expect(renderer!.supportsGeometry({ type: 'Polygon', coordinates: [] })).toBe(true)
      expect(renderer!.supportsGeometry({ type: 'Point', coordinates: [0, 0] })).toBe(false)
    })

    it('resolves reusable + type-specific finding rules', () => {
      const ruleIds = environmentalEventRegistry.getFindingRules(TYPE).map((r) => r.id)
      expect(ruleIds).toContain(SYNTHETIC_RULE_ID)
      expect(ruleIds).toContain('EVENT_PERSISTENT')
      expect(ruleIds).toContain('MULTIPLE_SOURCES_AGREE')
    })

    it('presentation renders a synthetic fixture', () => {
      const name = syntheticPresentationAdapter.getDisplayName(syntheticFixtures[0])
      expect(name).toContain('sintético')
    })

    it('priority provider yields qualitative factors', () => {
      const factors = environmentalEventRegistry
        .getPriorityProvider(TYPE)
        .getSeverityFactors(syntheticFixtures[0], {})
      expect(factors[0]?.domain).toBe('severity')
    })

    it('can build a National-Situation-style summary from the manifest', async () => {
      const summaries: Array<{ type: string; label: string; activeCount: number }> = []
      for (const manifest of environmentalEventRegistry.listEnabled()) {
        const repo = serverEventRegistry.getRepository(manifest.type)
        if (!repo?.summarize) continue
        const snap = await repo.summarize(48)
        summaries.push({ type: manifest.type, label: manifest.label, activeCount: snap.activeCount })
      }
      expect(summaries.some((s) => s.type === TYPE && s.activeCount === syntheticFixtures.length)).toBe(
        true,
      )
    })
  })
})
