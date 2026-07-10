import { BIODIVERSITY_MONITORED_ZONES } from '../config/biodiversity-zones.config'
import { haversineMeters } from '@/pipeline/engines/fire/event-scoring'

export type MonitoredZoneRelation = 'inside' | 'intersects' | 'near' | 'outside' | 'unavailable'

export interface MonitoredZoneContext {
  zone_code: string
  name: string
  relation: MonitoredZoneRelation
  distance_m: number | null
  available: boolean
  warnings: string[]
}

export interface ResolvedMonitoredZoneContext {
  primary: MonitoredZoneContext | null
  zones: MonitoredZoneContext[]
}

function relationForDistance(
  distanceM: number,
  zoneRadiusM: number,
  nearFactor: number,
): MonitoredZoneRelation {
  if (distanceM <= zoneRadiusM * 0.5) return 'inside'
  if (distanceM <= zoneRadiusM) return 'intersects'
  if (distanceM <= zoneRadiusM * nearFactor) return 'near'
  return 'outside'
}

export function resolveMonitoredZoneContext(input: {
  latitude: number | null
  longitude: number | null
  maxSpreadM?: number
  nearFactor?: number
}): ResolvedMonitoredZoneContext {
  if (input.latitude == null || input.longitude == null) {
    return {
      primary: null,
      zones: BIODIVERSITY_MONITORED_ZONES.map((z) => ({
        zone_code: z.code,
        name: z.name,
        relation: 'unavailable',
        distance_m: null,
        available: false,
        warnings: ['event_location_unavailable'],
      })),
    }
  }

  const nearFactor = input.nearFactor ?? 1.25
  const zones: MonitoredZoneContext[] = BIODIVERSITY_MONITORED_ZONES.map((zone) => {
    const distanceM = haversineMeters(
      input.latitude!,
      input.longitude!,
      zone.latitude,
      zone.longitude,
    )
    let relation = relationForDistance(distanceM, zone.radiusM, nearFactor)
    if (
      relation === 'outside' &&
      input.maxSpreadM &&
      distanceM - input.maxSpreadM <= zone.radiusM
    ) {
      relation = 'intersects'
    }
    const warnings: string[] = []
    if (relation === 'near') warnings.push('event_near_monitored_zone')
    return {
      zone_code: zone.code,
      name: zone.name,
      relation,
      distance_m: Math.round(distanceM),
      available: true,
      warnings,
    }
  })

  const ranked = [...zones].sort((a, b) => {
    const order: Record<MonitoredZoneRelation, number> = {
      inside: 0,
      intersects: 1,
      near: 2,
      outside: 3,
      unavailable: 4,
    }
    const rel = order[a.relation] - order[b.relation]
    if (rel !== 0) return rel
    return (a.distance_m ?? Number.MAX_SAFE_INTEGER) - (b.distance_m ?? Number.MAX_SAFE_INTEGER)
  })

  return {
    primary: ranked[0] ?? null,
    zones,
  }
}
