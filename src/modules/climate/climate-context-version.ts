import { createHash } from 'node:crypto'

export interface ClimateContextVersionInput {
  provider: string
  model: string
  variables: string[]
  eventTimeMatchingMethod: string
  representativePoints: number
  temporalToleranceMinutes: number
  dryDayThresholdMm: number
  accumulationWindows: string
  forecastWindows: string
  timezone: string
  aggregationMethod: string
}

export function buildClimateContextVersion(input: ClimateContextVersionInput): string {
  const payload = [
    input.provider,
    input.model,
    [...input.variables].sort().join(','),
    input.eventTimeMatchingMethod,
    String(input.representativePoints),
    String(input.temporalToleranceMinutes),
    String(input.dryDayThresholdMm),
    input.accumulationWindows,
    input.forecastWindows,
    input.timezone,
    input.aggregationMethod,
  ].join('|')
  return createHash('sha256').update(payload).digest('hex').slice(0, 16)
}
