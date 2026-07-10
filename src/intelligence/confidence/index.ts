import type { ConfidenceLevel, Evidence } from '@/intelligence/types'

export function scoreConfidence(evidence: Evidence[]): ConfidenceLevel {
  if (evidence.length === 0) return 'insufficient'
  if (evidence.length >= 3 && evidence.every((e) => e.confidence === 'high')) return 'high'
  if (evidence.some((e) => e.confidence === 'high')) return 'medium'
  return 'low'
}

export function confidenceLabel(level: ConfidenceLevel): string {
  const labels: Record<ConfidenceLevel, string> = {
    high: 'Alta confianza',
    medium: 'Confianza media',
    low: 'Baja confianza',
    insufficient: 'Evidencia insuficiente',
  }
  return labels[level]
}

export function confidenceColor(level: ConfidenceLevel): string {
  const colors: Record<ConfidenceLevel, string> = {
    high: 'text-confidence-high',
    medium: 'text-confidence-medium',
    low: 'text-confidence-low',
    insufficient: 'text-text-tertiary',
  }
  return colors[level]
}
