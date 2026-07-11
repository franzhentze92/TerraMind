import { describe, expect, it } from 'vitest'
import { ensureEventsRegistered } from '@/modules/environmental-events/registry/register-all'
import { environmentalEventRegistry } from '@/modules/environmental-events/registry/event-type-registry'
import { rainfallDeficitPresentationAdapter } from './event.presentation'
import { rainfallDeficitMapRenderer } from './event.map-renderer'
import { rainfallDeficitSpecificFindingRules, RAINFALL_DEFICIT_RULE_IDS } from './event.finding-rules'
import { rainfallDeficitPriorityFactorProvider } from './event.priority-provider'
import type { RainfallDeficitEnvironmentalEvent } from './event.types'

describe('rainfall_deficit plugin', () => {
  it('is auto-registered but disabled in runtime', () => {
    ensureEventsRegistered()
    expect(environmentalEventRegistry.has('rainfall_deficit')).toBe(true)
    expect(environmentalEventRegistry.isEnabled('rainfall_deficit')).toBe(false)
  })

  it('presents metrics in Spanish without raw enums', () => {
    const event: RainfallDeficitEnvironmentalEvent = {
      id: 'test',
      eventType: 'rainfall_deficit',
      title: 'Déficit de precipitación persistente en Chiquimula',
      status: 'active',
      epistemicStatus: 'observed',
      classification: 'operational',
      geometry: { type: 'MultiPolygon', coordinates: [] },
      firstObservedAt: '2024-05-01T00:00:00.000Z',
      lastObservedAt: '2024-05-31T00:00:00.000Z',
      observationCount: 4,
      sourceIds: ['chirps_v3_final_pentad'],
      sourceNames: ['CHIRPS v3'],
      attributes: {
        canonicalWindowDays: 30,
        windows: {
          days30: {
            analysisWindowDays: 30,
            analysisWindowPentads: 6,
            observedRainfallMm: 40,
            expectedRainfallMm: 100,
            absoluteDeficitMm: 60,
            relativeDeficitPercent: 60,
            historicalPercentile: 8,
            historicalSampleYears: 22,
          },
        },
        consecutiveDeficitPentads: 4,
        persistenceDays: 20,
        affectedAreaKm2: 120,
        affectedCellCount: 8,
        currentProductStatus: 'final',
        sourceVersion: '3.0',
        timestep: 'pentad',
        processingVersion: 'rainfall-deficit-mvp-1',
        baselineStartYear: 1991,
        baselineEndYear: 2020,
        qualityFlags: [],
        gridResolutionDegrees: 0.05,
        intensityClass: 'severe',
      },
      createdAt: '2024-05-01T00:00:00.000Z',
      updatedAt: '2024-05-31T00:00:00.000Z',
      lifecycleState: 'persistent',
    }
    const metrics = rainfallDeficitPresentationAdapter.getKeyMetrics(event)
    expect(metrics.some((m) => m.label.includes('Percentil'))).toBe(true)
    expect(JSON.stringify(metrics)).not.toMatch(/severe|preliminary|snake/)
    const popup = rainfallDeficitMapRenderer.getPopupModel(event)
    expect(popup.title).toContain('Déficit')
    expect(popup.rows.some((r) => r.label === 'Lluvia observada')).toBe(true)
  })

  it('registers type-specific finding rules', () => {
    expect(rainfallDeficitSpecificFindingRules.map((r) => r.id)).toContain(
      RAINFALL_DEFICIT_RULE_IDS.severe,
    )
  })

  it('exposes priority factors', () => {
    const event = {
      attributes: {
        windows: { days30: { analysisWindowDays: 30, analysisWindowPentads: 6, observedRainfallMm: 40, relativeDeficitPercent: 50, historicalPercentile: 10 } },
        consecutiveDeficitPentads: 3,
        affectedAreaKm2: 50,
        currentProductStatus: 'preliminary' as const,
        intensityClass: 'elevated' as const,
      },
      lifecycleState: 'expanding' as const,
    } as RainfallDeficitEnvironmentalEvent
    expect(rainfallDeficitPriorityFactorProvider.getSeverityFactors(event).length).toBeGreaterThan(0)
    expect(rainfallDeficitPriorityFactorProvider.getUncertaintyFactors(event).length).toBeGreaterThan(0)
  })
})
