/**
 * Auditoría del caso rural Huehuetenango (7D.2).
 * Coordenadas reportadas en validación territorial 7D.1B.
 */
import { createPopulationAdminService } from '@/modules/territory/population/admin/population-admin.service'
import { findNearestSettlementsAtPoint } from '@/modules/territory/population/admin/settlement-index'
import { buildPopulationComparison } from '@/modules/territory/population/raster/population-variant-compare'
import { createPopulationService } from '@/modules/territory/population/population.service'

export const RURAL_HUEHUETENANGO_COORDS = {
  lat: 15.3147,
  lon: -91.4761,
  label: 'Comunidad rural dispersa (Huehuetenango)',
} as const

export const HUEHUETENANGO_DEPARTMENT_CODE = '13'

export type RuralHuehuetenangoConclusion =
  | 'plausible'
  | 'requires_caution'
  | 'misclassified_point'
  | 'possible_artificial_concentration'
  | 'pending_missing_source'

export interface RuralHuehuetenangoAudit {
  coordinates: { lat: number; lon: number }
  buffers: Array<{
    radiusM: number
    constrained: number
    unconstrained: number
    percentageDifference: number
    coveragePct: number
  }>
  nearestSettlements: ReturnType<typeof findNearestSettlementsAtPoint>
  departmentOfficial?: {
    code: string
    name: string
    population: number
    referenceYear: number
    statisticType: string
  }
  pointSample?: {
    constrainedCell: number
    unconstrainedCell?: number
  }
  analysis: {
    distanceToNearestMunicipalSeatM?: number
    nearestSeatName?: string
    constrainedVsUnconstrainedInterpretation: string
    bufferVsMunicipalTotalWarning: string
  }
  conclusion: RuralHuehuetenangoConclusion
  conclusionRationale: string
}

export async function auditRuralHuehuetenango(): Promise<RuralHuehuetenangoAudit> {
  const { lat, lon } = RURAL_HUEHUETENANGO_COORDS
  const population = createPopulationService()
  const admin = createPopulationAdminService()

  const nearest = findNearestSettlementsAtPoint(lat, lon, 8)
  const nearestSeat = nearest[0]

  let buffers: RuralHuehuetenangoAudit['buffers'] = []
  let pointSample: RuralHuehuetenangoAudit['pointSample']

  try {
    const bufferResult = await population.analyzeBuffers({
      points: [{ lat, lon }],
      radiiMeters: [500, 1000, 3000],
      includeValidation: true,
    })
    buffers = bufferResult.buffers.map((b) => {
      const comparison =
        b.validationEstimate != null
          ? buildPopulationComparison(b.estimatedPopulation, b.validationEstimate)
          : { percentageDifference: 0 }
      return {
        radiusM: b.radiusM,
        constrained: b.estimatedPopulation,
        unconstrained: b.validationEstimate ?? 0,
        percentageDifference: comparison.percentageDifference,
        coveragePct: b.dataCoveragePct,
      }
    })

    const constrainedSample = await population.samplePoint({ latitude: lat, longitude: lon })
    let unconstrainedCell: number | undefined
    try {
      const unc = await population.samplePoint({
        latitude: lat,
        longitude: lon,
        variant: 'unconstrained',
      })
      unconstrainedCell = unc.populationCellEstimate
    } catch {
      /* raster optional */
    }
    pointSample = {
      constrainedCell: constrainedSample.populationCellEstimate,
      unconstrainedCell,
    }
  } catch {
    /* WorldPop no disponible en CI */
  }

  const deptRecord = await admin.getDepartmentPopulation({
    departmentCode: HUEHUETENANGO_DEPARTMENT_CODE,
    referenceYear: 2020,
    statisticType: 'projection',
  })

  const km1 = buffers.find((b) => b.radiusM === 1000)
  const largeDiff = (km1?.percentageDifference ?? 0) > 50

  let conclusion: RuralHuehuetenangoConclusion = 'requires_caution'
  let rationale =
    'Diferencia extrema constrained/unconstrained en 1 km; requiere contexto administrativo y de asentamientos antes de usar en decisiones.'

  if (!buffers.length) {
    conclusion = 'pending_missing_source'
    rationale = 'Sin raster WorldPop local para cuantificar el caso.'
  } else if (largeDiff && nearestSeat && nearestSeat.distanceM < 3000) {
    conclusion = 'possible_artificial_concentration'
    rationale = `Buffer de 1 km con Δ ${km1?.percentageDifference.toFixed(1)}% y cabecera municipal a ${nearestSeat.distanceM} m sugiere redistribución constrained hacia superficie construida cercana, no población rural dispersa uniforme.`
  } else if (largeDiff) {
    conclusion = 'requires_caution'
    rationale = `Δ ${km1?.percentageDifference.toFixed(1)}% en 1 km sin cabecera inmediata; puede reflejar covariables del modelo o geometría del buffer.`
  } else if (km1 && km1.percentageDifference < 15) {
    conclusion = 'plausible'
    rationale = 'Diferencia constrained/unconstrained moderada en 1 km.'
  }

  if (nearestSeat && nearestSeat.name.toLowerCase().includes('huehuetenango') && nearestSeat.distanceM < 5000) {
    conclusion = 'misclassified_point'
    rationale = `El punto etiquetado como "rural disperso" está a ${nearestSeat.distanceM} m de ${nearestSeat.name} (cabecera); la etiqueta territorial es engañosa para buffers amplios.`
  }

  return {
    coordinates: { lat, lon },
    buffers,
    nearestSettlements: nearest,
    departmentOfficial: deptRecord
      ? {
          code: deptRecord.adminCode,
          name: deptRecord.adminName,
          population: deptRecord.populationTotal,
          referenceYear: deptRecord.referenceYear,
          statisticType: deptRecord.statisticType,
        }
      : undefined,
    pointSample,
    analysis: {
      distanceToNearestMunicipalSeatM: nearestSeat?.distanceM,
      nearestSeatName: nearestSeat?.name,
      constrainedVsUnconstrainedInterpretation: largeDiff
        ? 'Diferencia significativa entre variantes; no declarar coherencia automática.'
        : 'Diferencia dentro de rango moderado.',
      bufferVsMunicipalTotalWarning:
        'No comparar población en buffer de 1 km con el total departamental como áreas equivalentes.',
    },
    conclusion,
    conclusionRationale: rationale,
  }
}
