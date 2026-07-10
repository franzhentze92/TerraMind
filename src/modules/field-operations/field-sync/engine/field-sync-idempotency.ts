export function bundleRegistrationKey(bundleId: string, bundleChecksum: string): string {
  return `bundle:${bundleId}:${bundleChecksum}`
}

export function submissionKey(localEvidenceId: string, localRevision: number, bundleChecksum: string): string {
  return `submission:${localEvidenceId}:r${localRevision}:${bundleChecksum.slice(0, 16)}`
}

export function assetKey(localAssetId: string, sha256: string): string {
  return `asset:${localAssetId}:${sha256.slice(0, 32)}`
}

export function observationKey(localEvidenceId: string, checksum: string): string {
  return `observation:${localEvidenceId}:${checksum.slice(0, 32)}`
}

export function requirementLinkKey(submissionId: string, requirementId: string): string {
  return `reqlink:${submissionId}:${requirementId}`
}

export function uploadSessionKey(localAssetId: string, sha256: string): string {
  return `upload:${localAssetId}:${sha256.slice(0, 32)}`
}

export function validationEnqueueKey(submissionId: string, bundleChecksum: string): string {
  return `validate:${submissionId}:${bundleChecksum.slice(0, 16)}`
}
