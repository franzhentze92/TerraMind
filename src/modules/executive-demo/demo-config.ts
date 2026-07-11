/** Real incident with highest pilot coverage (Field Sync Pilot missions + evidence). */
export const INTERNAL_DEMO_INCIDENT_ID = '8cd9487a-6823-43d6-b186-3166165db05a'

export const INTERNAL_DEMO_MISSION_MARKER = 'Field Sync Pilot'

export const DEMO_DISCLAIMER =
  'Demostración interna — no representa un evento ambiental confirmado'

export function isInternalDemoMissionTitle(title: string | null | undefined): boolean {
  return Boolean(title?.includes(INTERNAL_DEMO_MISSION_MARKER))
}

export function isInternalDemoIncidentId(incidentId: string): boolean {
  return incidentId === INTERNAL_DEMO_INCIDENT_ID
}
