import { describe, expect, it } from 'vitest'
import { ensureEventsRegistered } from '@/modules/environmental-events/registry/register-all'
import type { RainfallDeficitEnvironmentalEvent } from '@/modules/environmental-events/types/environmental-event.types'
import { buildSelectedThreatModel, THREAT_PENDING } from './selected-threat-model'

describe('buildSelectedThreatModel', () => {
  it('maps rainfall deficit exposure fields and marks economics as pending', () => {
    ensureEventsRegistered()

    const event: RainfallDeficitEnvironmentalEvent = {
      id: 'rd-1',
      eventType: 'rainfall_deficit',
      title: 'Corredor seco oriental',
      status: 'active',
      epistemicStatus: 'observed',
      classification: 'operational',
      geometry: { type: 'MultiPolygon', coordinates: [] },
      firstObservedAt: '2024-05-01T00:00:00.000Z',
      lastObservedAt: '2024-05-31T00:00:00.000Z',
      observationCount: 4,
      sourceIds: ['chirps'],
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
          },
        },
        consecutiveDeficitPentads: 4,
        persistenceDays: 20,
        affectedAreaKm2: 120,
        affectedCellCount: 8,
        municipalityCount: 18,
        municipalityNames: ['Jalapa', 'Chiquimula', 'Zacapa'],
        croplandOverlapKm2: 2450,
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

    const model = buildSelectedThreatModel(event)

    expect(model.typeLabel).toBe('Déficit de precipitación persistente')
    expect(model.territoryLine).toBe('Jalapa • Chiquimula • Zacapa')
    expect(model.status.value).toBe('En observación')
    expect(model.confidence.value).toBe('Alta')
    expect(model.severity.value).toBe('Alta')

    const municipalities = model.metrics.find((m) => m.key === 'municipalities')
    const cropland = model.metrics.find((m) => m.key === 'agricultural_area')
    const productive = model.metrics.find((m) => m.key === 'productive_value')

    expect(municipalities?.value).toBe('18')
    expect(cropland?.value).toMatch(/245[.,]000 ha/)
    expect(productive?.value).toBe(THREAT_PENDING)
    expect(model.benefitCostRatio).toBe(THREAT_PENDING)
  })
})
