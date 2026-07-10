import { createHash } from 'node:crypto'

import { FIRE_FINDING_RULE_SET_VERSION } from './config/fire-finding.config'

export interface FindingsContextVersionInput {
  ruleSetVersion: string
  fireEventSignature?: string | null
  protectedAreaVersion?: string | null
  landCoverVersion?: string | null
  populationVersion?: string | null
  climateVersion?: string | null
  biodiversityVersion?: string | null
}

export function buildFindingsContextVersion(input: FindingsContextVersionInput): string {
  const payload = [
    input.ruleSetVersion,
    input.fireEventSignature ?? 'none',
    input.protectedAreaVersion ?? 'none',
    input.landCoverVersion ?? 'none',
    input.populationVersion ?? 'none',
    input.climateVersion ?? 'none',
    input.biodiversityVersion ?? 'none',
  ].join('|')
  return createHash('sha256').update(payload).digest('hex').slice(0, 16)
}

export function buildFireEventSignature(input: {
  detection_count: number
  last_detected_at: string | null
  validation_status: string
}): string {
  return `${input.detection_count}:${input.last_detected_at ?? 'none'}:${input.validation_status}`
}

export function defaultRuleSetVersion(): string {
  return FIRE_FINDING_RULE_SET_VERSION
}
