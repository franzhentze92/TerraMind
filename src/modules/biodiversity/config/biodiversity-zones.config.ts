/** Zona monitoreada con centroide fijo — el frontend no envía coordenadas arbitrarias. */
export interface BiodiversityMonitoredZone {
  code: string
  name: string
  regionLabel: string
  latitude: number
  longitude: number
  /** Radio de consulta en metros. */
  radiusM: number
  enabled: boolean
}

export const BIODIVERSITY_MONITORED_ZONES: BiodiversityMonitoredZone[] = [
  {
    code: 'maya',
    name: 'Reserva de la Biosfera Maya',
    regionLabel: 'Petén',
    latitude: 17.22,
    longitude: -89.63,
    radiusM: 50_000,
    enabled: true,
  },
  {
    code: 'acatenango',
    name: 'Volcán Acatenango',
    regionLabel: 'Chimaltenango / Sacatepéquez',
    latitude: 14.501,
    longitude: -90.876,
    radiusM: 25_000,
    enabled: true,
  },
  {
    code: 'manchon',
    name: 'Manchón Guamuchal',
    regionLabel: 'Costa del Pacífico',
    latitude: 14.02,
    longitude: -91.73,
    radiusM: 30_000,
    enabled: true,
  },
  {
    code: 'sierra-minas',
    name: 'Sierra de las Minas',
    regionLabel: 'Baja Verapaz / Izabal',
    latitude: 15.1,
    longitude: -89.55,
    radiusM: 40_000,
    enabled: true,
  },
  {
    code: 'atitlan',
    name: 'Lago de Atitlán',
    regionLabel: 'Sololá / Chimaltenango',
    latitude: 14.69,
    longitude: -91.2,
    radiusM: 25_000,
    enabled: true,
  },
]

export function getEnabledBiodiversityZones(): BiodiversityMonitoredZone[] {
  return BIODIVERSITY_MONITORED_ZONES.filter((z) => z.enabled)
}

export function getBiodiversityZoneByCode(code: string): BiodiversityMonitoredZone | undefined {
  return BIODIVERSITY_MONITORED_ZONES.find((z) => z.code === code && z.enabled)
}

export const BIODIVERSITY_ZONE_CODES = BIODIVERSITY_MONITORED_ZONES.filter((z) => z.enabled).map(
  (z) => z.code,
)
