import {
  ALLOWED_MIME_TYPES,
  EXTENSION_MIME_MAP,
  MAX_FILE_SIZE_BYTES,
} from '@/modules/evidence/config/fire-evidence-intake.config'
import type { EvidenceIntegrityResult } from '@/modules/evidence/evidence-intake.types'

const SHA256_RE = /^[a-f0-9]{64}$/i

export function evaluateAssetIntegrity(input: {
  evidence_type: string
  original_filename: string
  mime_type: string
  size_bytes: number
  checksum_sha256?: string | null
}): EvidenceIntegrityResult {
  const reasons: string[] = []
  const warnings: string[] = []

  const sizeValid = input.size_bytes > 0 && input.size_bytes <= MAX_FILE_SIZE_BYTES
  if (!sizeValid) reasons.push('Tamaño de archivo fuera de rango permitido')

  const allowed = ALLOWED_MIME_TYPES[input.evidence_type] ?? []
  const mimeValid = allowed.length === 0 || allowed.includes(input.mime_type)
  if (!mimeValid) reasons.push(`MIME ${input.mime_type} no permitido para ${input.evidence_type}`)

  const ext = input.original_filename.split('.').pop()?.toLowerCase() ?? ''
  const expectedMimes = EXTENSION_MIME_MAP[ext] ?? []
  const extensionMismatch =
    expectedMimes.length > 0 && !expectedMimes.includes(input.mime_type)
  if (extensionMismatch) {
    warnings.push('Extensión y MIME no coinciden')
  }

  const checksumValid =
    !input.checksum_sha256 || SHA256_RE.test(input.checksum_sha256)
  if (!checksumValid) reasons.push('Checksum SHA-256 inválido')

  const valid = sizeValid && mimeValid && checksumValid
  if (valid) warnings.push('Integridad de archivo verificada; no implica autenticidad del contenido')

  return {
    valid,
    checksum_valid: checksumValid,
    size_valid: sizeValid,
    mime_valid: mimeValid,
    extension_mismatch: extensionMismatch,
    reasons,
    warnings,
  }
}
