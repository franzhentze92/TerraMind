import type { BiodiversityProviderId } from './biodiversity.types'

export interface LicenseEvaluationInput {
  license?: string | null
  source: BiodiversityProviderId
  hasMedia?: boolean
}

export interface LicenseEvaluationResult {
  license?: string
  attributionRequired: boolean
  redistributionAllowed: boolean
  warnings: string[]
}

function normalizeLicense(license?: string | null): string | undefined {
  if (!license) return undefined
  const trimmed = license.trim()
  if (!trimmed) return undefined
  if (trimmed.startsWith('http')) {
    const lower = trimmed.toLowerCase()
    if (lower.includes('creativecommons.org/publicdomain/zero')) return 'CC0-1.0'
    if (lower.includes('/by-nc-nd/')) return 'CC-BY-NC-ND-4.0'
    if (lower.includes('/by-nc-sa/')) return 'CC-BY-NC-SA-4.0'
    if (lower.includes('/by-nc/')) return 'CC-BY-NC-4.0'
    if (lower.includes('/by-sa/')) return 'CC-BY-SA-4.0'
    if (lower.includes('/by-nd/')) return 'CC-BY-ND-4.0'
    if (lower.includes('/by/')) return 'CC-BY-4.0'
  }
  return trimmed
}

const RESTRICTIVE = new Set(['CC-BY-NC-4.0', 'CC-BY-NC-SA-4.0', 'CC-BY-NC-ND-4.0', 'CC-BY-ND-4.0'])

/**
 * Evalúa licencia por ocurrencia. Licencia desconocida genera warning.
 * No asume que licencia del dataset cubre fotografías o audios.
 */
export function evaluateOccurrenceLicense(input: LicenseEvaluationInput): LicenseEvaluationResult {
  const license = normalizeLicense(input.license)
  const warnings: string[] = []

  if (!license) {
    warnings.push('unknown_license')
  }

  if (input.hasMedia) {
    warnings.push('media_license_not_verified')
  }

  if (license && (license.toLowerCase().includes('all rights reserved') || license === 'NONE')) {
    warnings.push('restrictive_license')
  }

  const redistributionAllowed = license !== undefined && !RESTRICTIVE.has(license)

  return {
    license,
    attributionRequired: true,
    redistributionAllowed,
    warnings,
  }
}

export function buildAttributionNotice(source: BiodiversityProviderId): string {
  if (source === 'gbif') {
    return 'Datos vía GBIF.org. Verifique licencia y atribución por registro.'
  }
  return 'Datos vía iNaturalist. Verifique licencia del observador por registro.'
}
