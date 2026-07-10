import { createHash } from 'node:crypto'

import { BIODIVERSITY_EVENT_CONFIG } from './config/biodiversity-event.config'

export const BIODIVERSITY_DEDUP_VERSION = 'v1-cross-provider-scientific-name-date'
export const BIODIVERSITY_PRIVACY_POLICY = 'generalize-obscured-withhold-private'
export const BIODIVERSITY_SPATIAL_PRECISION_POLICY = 'exclude-uncertainty-gt-radius'
export const BIODIVERSITY_MEDIA_LICENSE_POLICY = 'display-usable-only'
export const BIODIVERSITY_AGGREGATION_METHOD = 'nested-radius-filter-dedup'

export interface BiodiversityContextVersionInput {
  providers: string[]
  providerVersions: string
  radiiM: number[]
  historyYears: number
  recentDays: number
  eventWindowDays: number
  privacyPolicy: string
  spatialPrecisionPolicy: string
  deduplicationVersion: string
  taxonomicMapping: string
  mediaLicensePolicy: string
  aggregationMethod: string
}

export function buildBiodiversityContextVersion(
  input?: Partial<BiodiversityContextVersionInput>,
): string {
  const payload = [
    (input?.providers ?? ['gbif', 'inaturalist']).sort().join(','),
    input?.providerVersions ?? 'gbif-api-v1|inaturalist-v1',
    (input?.radiiM ?? BIODIVERSITY_EVENT_CONFIG.radiiM).join(','),
    String(input?.historyYears ?? BIODIVERSITY_EVENT_CONFIG.historyYears),
    String(input?.recentDays ?? BIODIVERSITY_EVENT_CONFIG.recentDays),
    String(input?.eventWindowDays ?? BIODIVERSITY_EVENT_CONFIG.eventWindowDays),
    input?.privacyPolicy ?? BIODIVERSITY_PRIVACY_POLICY,
    input?.spatialPrecisionPolicy ?? BIODIVERSITY_SPATIAL_PRECISION_POLICY,
    input?.deduplicationVersion ?? BIODIVERSITY_DEDUP_VERSION,
    input?.taxonomicMapping ?? 'exclusive-taxa-groups-v1',
    input?.mediaLicensePolicy ?? BIODIVERSITY_MEDIA_LICENSE_POLICY,
    input?.aggregationMethod ?? BIODIVERSITY_AGGREGATION_METHOD,
  ].join('|')

  return createHash('sha256').update(payload).digest('hex').slice(0, 16)
}
