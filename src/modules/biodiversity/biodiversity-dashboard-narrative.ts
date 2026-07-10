import type { BiodiversityDashboardDataStatus } from './dto/biodiversity-dashboard.dto'

export interface NationalNarrativeInput {
  speciesCount: number
  observationsCount: number
  recent30d: number
  zonesMonitored: number
  topZoneName: string | null
  topZoneSpecies: number
  generalizedCount: number
  dataStatus: BiodiversityDashboardDataStatus
}

/**
 * Narrativa por reglas (sin IA). No afirma biodiversidad real total ni ausencia.
 */
export function buildNationalBiodiversityNarrative(input: NationalNarrativeInput): string {
  const parts: string[] = []

  if (input.observationsCount === 0) {
    parts.push(
      `En las ${input.zonesMonitored} zona(s) monitoreada(s) no se recuperaron observaciones documentadas en el periodo seleccionado.`,
    )
    parts.push(
      'Esto puede reflejar bajo esfuerzo de muestreo o indisponibilidad temporal de fuentes, no ausencia biológica.',
    )
    return parts.join(' ')
  }

  parts.push(
    `Se documentaron ${input.speciesCount} especie(s) distinta(s) en ${input.observationsCount} registro(s) aceptado(s) agregados de ${input.zonesMonitored} zona(s) monitoreada(s).`,
  )

  if (input.recent30d > 0) {
    parts.push(`${input.recent30d} observación(es) en los últimos 30 días.`)
  } else {
    parts.push('No hay observaciones recientes en los últimos 30 días en la muestra agregada.')
  }

  if (input.topZoneName && input.topZoneSpecies > 0) {
    parts.push(
      `Mayor riqueza documentada en la muestra: ${input.topZoneName} (${input.topZoneSpecies} especie(s) observada(s)).`,
    )
  }

  if (input.generalizedCount > 0) {
    parts.push(
      `${input.generalizedCount} registro(s) con coordenadas generalizadas u ocultas por privacidad.`,
    )
  }

  if (input.dataStatus === 'partial') {
    parts.push('Algunas fuentes o zonas no respondieron por completo; los totales pueden estar incompletos.')
  }

  if (input.dataStatus === 'truncated') {
    parts.push('La muestra alcanzó el límite de registros por zona; los totales son un piso documentado, no un inventario completo.')
  }

  parts.push(
    'Los datos reflejan observaciones reportadas en GBIF e iNaturalist, no población actual ni abundancia real.',
  )

  return parts.join(' ')
}

export function buildZoneBiodiversityNarrative(input: {
  zoneName: string
  speciesCount: number
  observationsCount: number
  recentCount: number
  periodLabel: string
}): string {
  if (input.observationsCount === 0) {
    return `En ${input.zoneName} no se recuperaron observaciones en ${input.periodLabel}. Puede indicar bajo esfuerzo de muestreo, no ausencia de especies.`
  }

  const parts = [
    `En ${input.zoneName} se documentaron ${input.speciesCount} especie(s) en ${input.observationsCount} registro(s) durante ${input.periodLabel}.`,
  ]

  if (input.recentCount > 0) {
    parts.push(`${input.recentCount} observación(es) reciente(s) en el periodo.`)
  } else {
    parts.push('Sin observaciones recientes en el sub-periodo evaluado.')
  }

  parts.push('No se infiere abundancia, ausencia ni riesgo de extinción sin fuente oficial.')
  return parts.join(' ')
}
