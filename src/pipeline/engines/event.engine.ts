import type { Evento } from '@/ontology/entities/evento'
import type { Observacion } from '@/ontology/entities/observacion'

const CLUSTER_RADIUS_KM = 15
const CLUSTER_WINDOW_HOURS = 24
const MIN_CLUSTER_SIZE = 3

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function hoursBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 3_600_000
}

interface Cluster {
  observations: Observacion[]
  regionId: string
  regionName: string
}

function clusterObservations(observations: Observacion[]): Cluster[] {
  const fireObs = observations.filter((o) => o.variableId === 'fire_radiative_power')
  const clusters: Cluster[] = []
  const assigned = new Set<string>()

  for (const obs of fireObs) {
    if (assigned.has(obs.id)) continue

    const [lng, lat] = obs.ubicacion.coordinates ?? [0, 0]
    const cluster: Cluster = {
      observations: [obs],
      regionId: obs.territorioId,
      regionName: obs.ubicacion.regionName ?? 'Guatemala',
    }
    assigned.add(obs.id)

    for (const other of fireObs) {
      if (assigned.has(other.id)) continue
      const [oLng, oLat] = other.ubicacion.coordinates ?? [0, 0]
      const dist = haversineKm(lat, lng, oLat, oLng)
      const timeDiff = hoursBetween(obs.timestamp, other.timestamp)

      if (dist <= CLUSTER_RADIUS_KM && timeDiff <= CLUSTER_WINDOW_HOURS) {
        cluster.observations.push(other)
        assigned.add(other.id)
      }
    }

    if (cluster.observations.length >= MIN_CLUSTER_SIZE) {
      clusters.push(cluster)
    }
  }

  return clusters
}

/**
 * Event Engine — agrupa observaciones espacial y temporalmente.
 */
export function detectFireEvents(
  observations: Observacion[],
  existingEvents: Evento[],
): Evento[] {
  const clusters = clusterObservations(observations)
  const existingClusterKeys = new Set(
    existingEvents
      .filter((e) => e.tipo === 'fire_cluster')
      .map((e) => `${e.territorioId}:${e.observacionIds.sort().join(',')}`),
  )

  const now = new Date().toISOString()
  const newEvents: Evento[] = []

  for (const cluster of clusters) {
    const key = `${cluster.regionId}:${cluster.observations.map((o) => o.id).sort().join(',')}`
    if (existingClusterKeys.has(key)) continue

    const avgFrp =
      cluster.observations.reduce((sum, o) => sum + (o.valor as number), 0) /
      cluster.observations.length

    const maxFrp = Math.max(...cluster.observations.map((o) => o.valor as number))

    newEvents.push({
      id: `evt:fire_cluster:${cluster.regionId}:${Date.now()}`,
      tipo: 'fire_cluster',
      territorioId: cluster.regionId,
      detectadoEn: now,
      observacionIds: cluster.observations.map((o) => o.id),
      variableId: 'fire_radiative_power',
      valorObservado: maxFrp,
      valorEsperado: 0,
      desviacion: avgFrp,
      severidad: maxFrp > 40 ? 'critica' : maxFrp > 20 ? 'significativa' : 'moderada',
      reglaId: 'R-DET-003',
      estado: 'detectado',
      metadata: {
        clusterSize: cluster.observations.length,
        regionName: cluster.regionName,
        avgFrp,
      },
    })
  }

  return newEvents
}
