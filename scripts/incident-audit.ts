#!/usr/bin/env tsx
import { config } from 'dotenv'
import { resolve } from 'node:path'

import { genericIncidentCorrelationEngine } from '@/modules/incidents/engine/generic-incident-correlation.engine'
import {
  loadFireEventIncidentSnapshot,
  listCandidateIncidentSnapshots,
  listFireEventCandidatesForIncidentCorrelation,
  listPeerFireEventSnapshots,
} from '@/modules/incidents/services/fire-incident-snapshot.loader'

config({ path: resolve(process.cwd(), '.env') })

async function main() {
  const candidates = await listFireEventCandidatesForIncidentCorrelation(10000)
  const evaluatedAt = new Date().toISOString()
  const results = []

  for (const event of candidates) {
    const snapshot = await loadFireEventIncidentSnapshot(event.id)
    if (!snapshot) continue
    const peers = (await listPeerFireEventSnapshots(event.id)).filter((p) => !p.active_incident_id)
    const incidents = await listCandidateIncidentSnapshots(snapshot.active_incident_id ?? undefined)
    const evaluation = genericIncidentCorrelationEngine.evaluate({
      event: snapshot,
      peerEvents: peers,
      candidateIncidents: incidents,
      evaluatedAt,
    })
    results.push({
      event_id: event.id,
      decision: evaluation.correlation_decision,
      score: evaluation.scores.correlation_score,
      target_incident_id: evaluation.target_incident_id,
      reasons: evaluation.correlation_reasons,
      rejected: evaluation.rejected_reasons,
      context_signature: evaluation.context_signature,
    })
  }

  results.sort((a, b) => a.event_id.localeCompare(b.event_id))
  console.log(
    JSON.stringify(
      {
        events_audited: results.length,
        correlation_model_version: genericIncidentCorrelationEngine.modelVersion,
        evaluated_at: evaluatedAt,
        events: results,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
