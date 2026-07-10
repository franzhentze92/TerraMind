import type { BiodiversityDashboardDataStatus } from './dto/biodiversity-dashboard.dto'
import { formatCountEs } from './biodiversity-text'

export interface NationalNarrativeInput {
  speciesCount: number
  observationsCount: number
  recent30d: number
  zonesMonitored: number
  topZoneName: string | null
  topZoneSpecies: number
  generalizedCount: number
  dataStatus: BiodiversityDashboardDataStatus
  periodLabel: string
  truncated: boolean
}

/**
 * Narrativa corta para tarjeta ejecutiva (máx. ~2 líneas).
 */
export function buildNationalBiodiversityCardNarrative(input: {
  speciesCount: number
  observationsCount: number
  zonesMonitored: number
  truncated: boolean
}): string {
  const obsLabel = input.truncated
    ? `al menos ${input.observationsCount.toLocaleString('es-GT')}`
    : input.observationsCount.toLocaleString('es-GT')

  const line1 = `${input.speciesCount.toLocaleString('es-GT')} especies documentadas en ${obsLabel} registros de ${input.zonesMonitored} territorios monitoreados.`

  if (input.truncated) {
    return `${line1} La muestra alcanzó el límite de consulta y no representa un inventario completo.`
  }

  return `${line1} La muestra refleja esfuerzo de observación, no inventario nacional.`
}

/**
 * Narrativa por reglas (sin IA). No afirma biodiversidad real total ni ausencia.
 */
export function buildNationalBiodiversityNarrative(input: NationalNarrativeInput): string {
  const parts: string[] = []

  if (input.observationsCount === 0) {
    parts.push(
      `En ${formatCountEs(input.zonesMonitored, 'territorio monitoreado', 'territorios monitoreados')} no se recuperaron observaciones documentadas en ${input.periodLabel}.`,
    )
    parts.push(
      'Esto puede reflejar bajo esfuerzo de muestreo o indisponibilidad temporal de fuentes, no ausencia biológica.',
    )
    return parts.join(' ')
  }

  const obsLabel = input.truncated
    ? formatCountEs(input.observationsCount, 'registro aceptado', 'registros aceptados', true)
    : formatCountEs(input.observationsCount, 'registro aceptado', 'registros aceptados')

  parts.push(
    `Se documentaron ${formatCountEs(input.speciesCount, 'especie distinta', 'especies distintas')} en ${obsLabel} correspondientes a ${formatCountEs(input.zonesMonitored, 'territorio monitoreado', 'territorios monitoreados')} durante ${input.periodLabel}.`,
  )

  if (input.recent30d > 0) {
    parts.push(
      `${formatCountEs(input.recent30d, 'observación', 'observaciones')} en los últimos 30 días dentro de la muestra consultada.`,
    )
  } else {
    parts.push('No hay observaciones en los últimos 30 días dentro de la muestra consultada.')
  }

  if (input.topZoneName && input.topZoneSpecies > 0) {
    parts.push(
      `Mayor riqueza documentada en la muestra: ${input.topZoneName} (${formatCountEs(input.topZoneSpecies, 'especie observada', 'especies observadas')}).`,
    )
  }

  if (input.generalizedCount > 0) {
    parts.push(
      `${formatCountEs(input.generalizedCount, 'registro con ubicación generalizada u oculta', 'registros con ubicación generalizada u oculta')} por privacidad.`,
    )
  }

  if (input.dataStatus === 'partial') {
    parts.push('Algunas fuentes o zonas no respondieron por completo; los totales pueden estar incompletos.')
  }

  if (input.truncated || input.dataStatus === 'truncated') {
    parts.push(
      'La muestra alcanzó el límite de registros por zona; los totales son un piso documentado, no un inventario completo.',
    )
  }

  parts.push(
    'Los datos reflejan biodiversidad documentada y esfuerzo de observación en zonas monitoreadas, no población actual ni abundancia real.',
  )

  return parts.join(' ')
}

export function buildZoneBiodiversityNarrative(input: {
  zoneName: string
  speciesCount: number
  observationsCount: number
  recentCount: number
  periodLabel: string
  truncated: boolean
  lowCoverage: boolean
}): string {
  if (input.observationsCount === 0) {
    return `En ${input.zoneName} no se recuperaron observaciones en ${input.periodLabel}. Puede indicar bajo esfuerzo de muestreo, no ausencia de especies.`
  }

  const obs = input.truncated
    ? formatCountEs(input.observationsCount, 'registro', 'registros', true)
    : formatCountEs(input.observationsCount, 'registro', 'registros')

  const parts = [
    `En ${input.zoneName} se documentaron ${formatCountEs(input.speciesCount, 'especie', 'especies')} en ${obs} durante ${input.periodLabel}.`,
  ]

  if (input.lowCoverage) {
    parts.push('Baja cobertura de observación en el período; no implica baja biodiversidad.')
  }

  if (input.recentCount > 0) {
    parts.push(
      `${formatCountEs(input.recentCount, 'observación reciente', 'observaciones recientes')} en los últimos 30 días.`,
    )
  } else {
    parts.push('Sin observaciones en los últimos 30 días dentro de la muestra.')
  }

  parts.push('No se infiere abundancia, ausencia ni riesgo de extinción sin fuente oficial.')
  return parts.join(' ')
}
