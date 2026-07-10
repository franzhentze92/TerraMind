import { evaluateOccurrenceLicense, type LicenseEvaluationResult } from './biodiversity-license'

const DISPLAYABLE_LICENSES = new Set([
  'CC0-1.0',
  'CC-BY-4.0',
  'CC-BY-SA-4.0',
  'CC-BY-NC-4.0',
  'CC-BY-NC-SA-4.0',
])

export interface ImageDisplayEvaluation {
  allowed: boolean
  license?: string
  warnings: string[]
  attributionRequired: boolean
}

/**
 * Evalúa si una imagen puede mostrarse en UI (hotlink con atribución).
 * No permite imágenes sin licencia reconocida ni restrictivas para redistribución.
 */
export function evaluateImageDisplay(license?: string | null): ImageDisplayEvaluation {
  const base: LicenseEvaluationResult = evaluateOccurrenceLicense({
    license,
    source: 'inaturalist',
    hasMedia: true,
  })

  const warnings = [...base.warnings]
  if (!base.license) {
    return { allowed: false, warnings, attributionRequired: true }
  }

  const allowed =
    DISPLAYABLE_LICENSES.has(base.license) ||
    base.license.toLowerCase().includes('creativecommons.org')

  if (!allowed) {
    warnings.push('image_license_not_displayable')
  }

  if (!base.redistributionAllowed && base.license.includes('NC')) {
    // Hotlink con atribución en contexto informativo — permitir CC-BY-NC con warning
    warnings.push('non_commercial_license')
  }

  const ncBlocked = base.license.includes('ND') || base.license === 'NONE'
  if (ncBlocked) {
    return { allowed: false, license: base.license, warnings, attributionRequired: true }
  }

  return {
    allowed: allowed || base.license.includes('BY'),
    license: base.license,
    warnings,
    attributionRequired: base.attributionRequired,
  }
}
