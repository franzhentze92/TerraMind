/** Parámetros operativos v1 — agrupación espacio-temporal FIRMS */

export const CLUSTER_CONFIG = {
  distanceThresholdM: 1500,
  timeThresholdHours: 12,
  bufferM: 375,
  activeHours: 12,
  monitoringHours: 24,
  clusterModelVersion: 'fire-cluster-v1',
  priorityModelVersion: 'fire-basic-v1',
} as const

export type ClusterConfig = typeof CLUSTER_CONFIG
