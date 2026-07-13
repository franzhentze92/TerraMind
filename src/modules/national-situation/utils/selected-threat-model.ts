/**
 * View-model for the "Amenaza seleccionada" panel on Situación Nacional.
 *
 * Maps canonical environmental events to the executive threat card fields.
 * Economic / response metrics that are not yet modeled return "Pendiente".
 */
import { environmentalEventRegistry } from '@/modules/environmental-events/registry/event-type-registry'
import type { EnvironmentalEvent } from '@/modules/environmental-events/types/environmental-event.types'
import { buildEventDetailModel } from '@/modules/environmental-events/ui/event-ui'
import { eventStatusLabel } from '@/modules/fires/utils/fire-interpretation'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  ClipboardList,
  Coins,
  MapPin,
  Scale,
  Wallet,
} from 'lucide-react'

export const THREAT_PENDING = 'Pendiente' as const

export type ThreatTone = 'high' | 'medium' | 'low' | 'neutral'

export interface ThreatStatusColumn {
  label: string
  value: string
  tone: ThreatTone
}

export interface ThreatMetricRow {
  key: string
  label: string
  value: string
  icon: LucideIcon
  danger?: boolean
}

export interface SelectedThreatModel {
  typeLabel: string
  accentColor: string
  icon: string
  title: string
  territoryLine: string | null
  status: ThreatStatusColumn
  confidence: ThreatStatusColumn
  severity: ThreatStatusColumn
  metrics: ThreatMetricRow[]
  benefitCostRatio: string
}

function resolveThreatTypeLabel(event: EnvironmentalEvent, manifestLabel: string): string {
  if (event.eventType === 'rainfall_deficit' && event.lifecycleState === 'persistent') {
    return `${manifestLabel} persistente`
  }
  return manifestLabel
}

function resolveTerritoryLine(event: EnvironmentalEvent): string | null {
  if (event.eventType === 'rainfall_deficit') {
    const names = event.attributes.municipalityNames
    if (names && names.length > 0) {
      return names.slice(0, 6).join(' • ')
    }
  }
  if (event.territory?.departmentName) return event.territory.departmentName
  return null
}

function resolveStatusColumn(event: EnvironmentalEvent, statusLabel: string): ThreatStatusColumn {
  if (event.eventType === 'thermal_activity') {
    const legacy = event.attributes.legacy.status
    return {
      label: 'Estado',
      value: eventStatusLabel(legacy),
      tone: legacy === 'monitoring' ? 'neutral' : 'neutral',
    }
  }

  if (event.status === 'monitoring') {
    return { label: 'Estado', value: 'En observación', tone: 'neutral' }
  }
  if (event.epistemicStatus === 'observed' && event.status === 'active') {
    return { label: 'Estado', value: 'En observación', tone: 'neutral' }
  }

  return { label: 'Estado', value: statusLabel, tone: 'neutral' }
}

function resolveConfidenceColumn(event: EnvironmentalEvent, confidenceLabel: string): ThreatStatusColumn {
  if (event.eventType === 'rainfall_deficit') {
    const product = event.attributes.currentProductStatus
    if (product === 'final') {
      return { label: 'Confianza', value: 'Alta', tone: 'high' }
    }
    if (product === 'preliminary') {
      return { label: 'Confianza', value: 'Media', tone: 'medium' }
    }
  }

  if (event.eventType === 'thermal_activity') {
    const validation = event.attributes.legacy.validationStatus
    if (validation === 'confirmado') {
      return { label: 'Confianza', value: 'Alta', tone: 'high' }
    }
    if (validation === 'probable') {
      return { label: 'Confianza', value: 'Media', tone: 'medium' }
    }
    return { label: 'Confianza', value: 'Baja', tone: 'low' }
  }

  const normalized = confidenceLabel.toLowerCase()
  if (normalized.includes('alta') || normalized.includes('confirm') || normalized === 'final') {
    return { label: 'Confianza', value: 'Alta', tone: 'high' }
  }
  if (normalized.includes('media') || normalized.includes('probable') || normalized === 'preliminar') {
    return { label: 'Confianza', value: 'Media', tone: 'medium' }
  }
  if (normalized.includes('baja') || normalized.includes('no valid')) {
    return { label: 'Confianza', value: 'Baja', tone: 'low' }
  }

  return { label: 'Confianza', value: confidenceLabel || THREAT_PENDING, tone: 'neutral' }
}

function resolveSeverityColumn(event: EnvironmentalEvent, severityLabel: string): ThreatStatusColumn {
  if (event.eventType === 'rainfall_deficit') {
    const intensity = event.attributes.intensityClass
    if (intensity === 'severe' || intensity === 'elevated') {
      return { label: 'Severidad', value: 'Alta', tone: 'high' }
    }
    if (intensity === 'moderate') {
      return { label: 'Severidad', value: 'Media', tone: 'medium' }
    }
    if (intensity === 'recovering') {
      return { label: 'Severidad', value: 'Baja', tone: 'low' }
    }
  }

  if (event.eventType === 'thermal_activity') {
    const score = event.severity ?? event.attributes.legacy.priorityScore
    if (score >= 4) return { label: 'Severidad', value: 'Alta', tone: 'high' }
    if (score === 3) return { label: 'Severidad', value: 'Media', tone: 'medium' }
    if (score > 0) return { label: 'Severidad', value: 'Baja', tone: 'low' }
  }

  const normalized = severityLabel.toLowerCase()
  if (normalized.includes('alta') || normalized.includes('sever') || normalized.includes('crít') || normalized.includes('atención')) {
    return { label: 'Severidad', value: 'Alta', tone: 'high' }
  }
  if (normalized.includes('media') || normalized.includes('moder') || normalized.includes('elev')) {
    return { label: 'Severidad', value: 'Media', tone: 'medium' }
  }
  if (normalized.includes('baja') || normalized.includes('informat') || normalized.includes('recuper')) {
    return { label: 'Severidad', value: 'Baja', tone: 'low' }
  }

  return { label: 'Severidad', value: severityLabel || THREAT_PENDING, tone: 'neutral' }
}

function formatCount(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return THREAT_PENDING
  return value.toLocaleString('es-GT')
}

function formatAgriculturalArea(event: EnvironmentalEvent): string {
  if (event.eventType === 'rainfall_deficit') {
    const km2 = event.attributes.croplandOverlapKm2
    if (km2 !== undefined && Number.isFinite(km2) && km2 > 0) {
      const ha = Math.round(km2 * 100)
      return `${ha.toLocaleString('es-GT')} ha`
    }
  }
  return THREAT_PENDING
}

function readMetadataCurrency(event: EnvironmentalEvent, key: string): string | null {
  const raw = event.metadata?.[key]
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return formatQuetzalesMillions(raw)
  }
  if (typeof raw === 'string' && raw.trim()) return raw
  return null
}

function formatQuetzalesMillions(amount: number): string {
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000
    const formatted =
      millions >= 100
        ? Math.round(millions).toLocaleString('es-GT')
        : millions.toLocaleString('es-GT', { maximumFractionDigits: 1 })
    return `Q ${formatted} millones`
  }
  return `Q ${amount.toLocaleString('es-GT')}`
}

function resolveBenefitCostRatio(event: EnvironmentalEvent): string {
  const raw = event.metadata?.benefitCostRatio
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return `${raw.toLocaleString('es-GT', { maximumFractionDigits: 1 })} : 1`
  }
  if (typeof raw === 'string' && raw.trim()) return raw
  return THREAT_PENDING
}

function buildMetrics(event: EnvironmentalEvent): ThreatMetricRow[] {
  const municipalityCount =
    event.eventType === 'rainfall_deficit' ? event.attributes.municipalityCount : undefined

  const productiveValue = readMetadataCurrency(event, 'productiveValueGtq')
  const potentialLoss = readMetadataCurrency(event, 'potentialLossGtq')
  const interventionCost = readMetadataCurrency(event, 'interventionCostGtq')
  const inactionCost = readMetadataCurrency(event, 'inactionCostGtq')

  return [
    {
      key: 'municipalities',
      label: 'Municipios afectados',
      value: formatCount(municipalityCount),
      icon: MapPin,
    },
    {
      key: 'agricultural_area',
      label: 'Superficie agrícola expuesta',
      value: formatAgriculturalArea(event),
      icon: Scale,
    },
    {
      key: 'productive_value',
      label: 'Valor productivo expuesto',
      value: productiveValue ?? THREAT_PENDING,
      icon: Coins,
    },
    {
      key: 'potential_loss',
      label: 'Pérdida potencial estimada',
      value: potentialLoss ?? THREAT_PENDING,
      icon: ClipboardList,
    },
    {
      key: 'intervention_cost',
      label: 'Costo estimado de intervención',
      value: interventionCost ?? THREAT_PENDING,
      icon: Wallet,
    },
    {
      key: 'inaction_cost',
      label: 'Costo de no actuar',
      value: inactionCost ?? THREAT_PENDING,
      icon: AlertTriangle,
      danger: true,
    },
  ]
}

export function buildSelectedThreatModel(event: EnvironmentalEvent): SelectedThreatModel {
  const manifest = environmentalEventRegistry.get(event.eventType)
  const detail = buildEventDetailModel(event)

  return {
    typeLabel: resolveThreatTypeLabel(event, manifest.label),
    accentColor: environmentalEventRegistry.getAccentColor(event.eventType),
    icon: manifest.icon,
    title: detail.title,
    territoryLine: resolveTerritoryLine(event),
    status: resolveStatusColumn(event, detail.statusLabel),
    confidence: resolveConfidenceColumn(event, detail.confidenceLabel),
    severity: resolveSeverityColumn(event, detail.severityLabel),
    metrics: buildMetrics(event),
    benefitCostRatio: resolveBenefitCostRatio(event),
  }
}

export function threatToneClass(tone: ThreatTone): string {
  switch (tone) {
    case 'high':
      return 'text-[#fb923c]'
    case 'medium':
      return 'text-status-warning'
    case 'low':
      return 'text-confidence-high'
    default:
      return 'text-text-primary'
  }
}

export function confidenceToneClass(tone: ThreatTone): string {
  switch (tone) {
    case 'high':
      return 'text-confidence-high'
    case 'medium':
      return 'text-status-warning'
    case 'low':
      return 'text-status-critical'
    default:
      return 'text-text-primary'
  }
}
