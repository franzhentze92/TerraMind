import type { FireEventDetailDto } from '@/modules/fires/types/fire.dto'
import { validationLabel } from '@/modules/fires/utils/format'

interface InterpretationInput {
  detection_count: number
  satellite_count: number
  validation_status: string
  risk_level: string
  persistence_hours: number | null
  multisatellite: boolean
}

export function buildEventInterpretation(input: InterpretationInput): string {
  const {
    detection_count,
    satellite_count,
    validation_status,
    risk_level,
    persistence_hours,
    multisatellite,
  } = input

  if (validation_status === 'confirmado') {
    return (
      `Incendio confirmado mediante ${detection_count} detección${
        detection_count === 1 ? '' : 'es'
      } satelital${detection_count === 1 ? '' : 'es'}` +
      (satellite_count > 1 ? ` observada por ${satellite_count} satélites.` : '.')
    )
  }

  if (detection_count === 1) {
    return (
      'Evento térmico basado en una sola detección satelital. ' +
      'La evidencia es limitada y requiere corroboración antes de elevar la respuesta operativa.'
    )
  }

  const persistence =
    persistence_hours != null && persistence_hours > 0
      ? ` durante ${formatPersistence(persistence_hours)}`
      : ''

  let text =
    `Este evento térmico fue observado mediante ${detection_count} detecciones provenientes de ` +
    `${satellite_count} satélite${satellite_count === 1 ? '' : 's'}${persistence}.`

  if (multisatellite || validation_status === 'probable') {
    text +=
      ' Por contar con evidencia multi-satélite o múltiples detecciones, se clasifica como evento probable.'
  } else {
    text += ' Se mantiene en observación hasta contar con mayor evidencia.'
  }

  if (risk_level === 'atencion') {
    text += ' Requiere atención operativa.'
  } else if (risk_level === 'observacion') {
    text += ' Permanece en observación.'
  } else {
    text += ' Clasificado como informativo.'
  }

  return text
}

export function buildEvidenceSummary(detail: Pick<
  FireEventDetailDto,
  'detection_count' | 'satellite_count' | 'source_products' | 'max_frp_mw' | 'validation_status'
>): string {
  const products = detail.source_products.join(', ') || 'sin fuente'
  const frp =
    detail.max_frp_mw != null ? `${detail.max_frp_mw.toFixed(2)} MW` : 'no reportado'
  return (
    `${detail.detection_count} detección${detail.detection_count === 1 ? '' : 'es'} · ` +
    `${detail.satellite_count} satélite${detail.satellite_count === 1 ? '' : 's'} · ` +
    `FRP máx. ${frp} · Fuentes: ${products} · ${validationLabel(detail.validation_status)}`
  )
}

function formatPersistence(hours: number): string {
  if (hours < 1) {
    const mins = Math.round(hours * 60)
    return `${mins} minuto${mins === 1 ? '' : 's'}`
  }
  if (hours < 24) {
    const h = Math.round(hours * 10) / 10
    return `${h} hora${h === 1 ? '' : 's'}`
  }
  return `${Math.round(hours)} horas`
}

export function eventStatusLabel(status: string): string {
  switch (status) {
    case 'new':
      return 'Nuevo'
    case 'active':
      return 'Activo'
    case 'monitoring':
      return 'En observación'
    case 'closed':
      return 'Cerrado'
    default:
      return status
  }
}

export function validationStatusLabel(status: string): string {
  switch (status) {
    case 'no_validado':
      return 'No validado'
    case 'probable':
      return 'Probable'
    case 'confirmado':
      return 'Confirmado'
    default:
      return status
  }
}

/** Etiqueta semántica para popups y resúmenes del mapa. */
export function eventSemanticLabel(validationStatus: string): string {
  switch (validationStatus) {
    case 'confirmado':
      return 'Incendio confirmado'
    case 'probable':
      return 'Evento térmico probable'
    default:
      return 'Detección no validada'
  }
}

export function confidenceLabel(conf: string | null): string {
  switch (conf) {
    case 'alta':
      return 'Alta'
    case 'media':
      return 'Media'
    case 'baja':
      return 'Baja'
    default:
      return '—'
  }
}

export const ACTIVE_STATUS_TOOLTIP =
  'Activo significa actividad satelital reciente en la ventana temporal; no confirma un incendio forestal activo.'

export function riskBadgeVariant(
  risk: string,
): 'default' | 'warning' | 'critical' | 'accent' {
  if (risk === 'atencion' || risk === 'alto' || risk === 'critico') return 'critical'
  if (risk === 'observacion') return 'warning'
  return 'default'
}
