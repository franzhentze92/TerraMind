import { CLUSTER_CONFIG } from '@/pipeline/engines/fire/cluster.config'
import {
  areConnected,
  maxInternalDistanceM,
  scoreCluster,
} from '@/pipeline/engines/fire/event-scoring'
import { UnionFind } from '@/pipeline/engines/fire/union-find'
import { scoredToEventRow } from '@/pipeline/engines/fire/cluster.builders'
import type {
  ClusterDetection,
  ClusterDryRunCluster,
  ClusterDryRunResult,
  ClusterRunMetrics,
  ClusterWritePlanItem,
  ConfirmedConflict,
  ExistingEvent,
  MergePlan,
} from '@/pipeline/stores/fire-event.types'
import {
  commitClusterBatch,
  fetchDetectionById,
  fetchExistingEvents,
  fetchNationalDetections,
  fetchNeighborPairs,
  getConfirmedReservedDetectionIds,
  refreshEventTemporalStatus,
  type ClusterOptions,
} from '@/pipeline/stores/supabase.fire-event.store'

function emptyMetrics(): ClusterRunMetrics {
  return {
    detections_considered: 0,
    detections_already_linked: 0,
    detections_newly_linked: 0,
    clusters_found: 0,
    events_created: 0,
    events_updated: 0,
    events_closed: 0,
    events_merged: 0,
    events_absorbed: 0,
    confirmed_event_conflicts: 0,
    detections_pending_review: 0,
    force_rebuild_events: 0,
    confirmed_events_preserved: 0,
    single_detection_events: 0,
    multi_detection_events: 0,
    multisatellite_events: 0,
    cross_department_events: 0,
    unlinked_detections: 0,
    errors: [],
    duration_ms: 0,
  }
}

function pickSurvivorEvent(events: ExistingEvent[]): ExistingEvent {
  return [...events].sort((a, b) => {
    const ta = new Date(a.created_at).getTime()
    const tb = new Date(b.created_at).getTime()
    if (ta !== tb) return ta - tb
    return a.id.localeCompare(b.id)
  })[0]
}

function buildConnectedComponents(
  detections: ClusterDetection[],
  pairs: Array<{ id_a: string; id_b: string }>,
): Map<string, ClusterDetection[]> {
  const uf = new UnionFind(detections.map((d) => d.id))
  for (const pair of pairs) uf.union(pair.id_a, pair.id_b)

  const byId = new Map(detections.map((d) => [d.id, d]))
  const groups = new Map<string, ClusterDetection[]>()

  for (const [, ids] of uf.components()) {
    const members = ids.map((id) => byId.get(id)!).filter(Boolean)
    if (members.length === 0) continue
    const root = [...ids].sort()[0]
    groups.set(root, members)
  }

  return groups
}

function mapDetectionsToEvents(
  detections: ClusterDetection[],
  events: ExistingEvent[],
): Map<string, string[]> {
  const detToEvents = new Map<string, string[]>()
  for (const event of events) {
    for (const detId of event.detection_ids) {
      const list = detToEvents.get(detId) ?? []
      list.push(event.id)
      detToEvents.set(detId, list)
    }
  }
  for (const det of detections) {
    if (det.event_id) {
      const list = detToEvents.get(det.id) ?? []
      if (!list.includes(det.event_id)) list.push(det.event_id)
      detToEvents.set(det.id, list)
    }
  }
  return detToEvents
}

function resolveEventMerges(
  componentDetectionIds: string[],
  events: ExistingEvent[],
  detToEvents: Map<string, string[]>,
): { merges: MergePlan[]; conflicts: ConfirmedConflict[]; involvedEventIds: string[] } {
  const involved = new Set<string>()
  for (const detId of componentDetectionIds) {
    for (const eid of detToEvents.get(detId) ?? []) involved.add(eid)
  }

  const involvedEvents = events.filter((e) => involved.has(e.id))
  const confirmed = involvedEvents.filter((e) => e.validation_status === 'confirmado')
  const automatic = involvedEvents.filter((e) => e.validation_status !== 'confirmado')

  const conflicts: ConfirmedConflict[] = []
  const merges: MergePlan[] = []

  if (confirmed.length > 1) {
    for (const detId of componentDetectionIds) {
      const linked = (detToEvents.get(detId) ?? []).filter((eid) =>
        confirmed.some((e) => e.id === eid),
      )
      if (linked.length > 1) {
        conflicts.push({
          detection_id: detId,
          event_ids: linked,
          reason: 'detección conecta dos eventos confirmados',
        })
      }
    }
    return { merges, conflicts, involvedEventIds: [...involved] }
  }

  if (confirmed.length === 1 && automatic.length > 0) {
    for (const detId of componentDetectionIds) {
      const hasConfirmed = (detToEvents.get(detId) ?? []).includes(confirmed[0].id)
      const hasAuto = automatic.some((e) => (detToEvents.get(detId) ?? []).includes(e.id))
      if (hasConfirmed && hasAuto) {
        conflicts.push({
          detection_id: detId,
          event_ids: [confirmed[0].id, ...automatic.map((e) => e.id)],
          reason: 'detección conecta evento confirmado con automático',
        })
      }
    }
    return { merges, conflicts, involvedEventIds: [...involved] }
  }

  if (automatic.length > 1) {
    const survivor = pickSurvivorEvent(automatic)
    const absorbed = automatic.filter((e) => e.id !== survivor.id).map((e) => e.id)
    if (absorbed.length > 0) {
      merges.push({
        survivor_event_id: survivor.id,
        absorbed_event_ids: absorbed,
        reason: 'componente conectado fusiona eventos automáticos',
      })
    }
  }

  return { merges, conflicts, involvedEventIds: [...involved] }
}

export async function runClusterPipeline(
  options: ClusterOptions = {},
): Promise<ClusterDryRunResult> {
  const start = Date.now()
  const metrics = emptyMetrics()
  const errors: string[] = []

  if (options.force && options.limit !== undefined && options.limit < 10000) {
    throw new Error('No se permite combinar --force con --limit')
  }

  const limit = options.force ? 10000 : (options.limit ?? 10000)
  const existingEvents = await fetchExistingEvents()
  const reservedIds = getConfirmedReservedDetectionIds(existingEvents)
  metrics.confirmed_events_preserved = existingEvents.filter(
    (e) => e.validation_status === 'confirmado',
  ).length

  let events = [...existingEvents]
  if (options.force) {
    events = events.filter((e) => e.validation_status === 'confirmado')
    metrics.force_rebuild_events = existingEvents.filter(
      (e) => e.validation_status !== 'confirmado',
    ).length
  }

  const linkedIds = new Set<string>()
  for (const event of existingEvents) {
    for (const id of event.detection_ids) linkedIds.add(id)
  }
  metrics.detections_already_linked = linkedIds.size

  const detections = await fetchNationalDetections(limit, reservedIds)
  metrics.detections_considered = detections.length

  const unlinked = detections.filter((d) => !linkedIds.has(d.id))
  const openEvents = events.filter((e) =>
    ['new', 'active', 'monitoring'].includes(e.status),
  )

  const detectionMap = new Map(detections.map((d) => [d.id, d]))
  for (const event of openEvents) {
    for (const detId of event.detection_ids) {
      if (!detectionMap.has(detId)) {
        const loaded = await fetchDetectionById(detId)
        if (loaded) {
          loaded.event_id = event.id
          detectionMap.set(detId, loaded)
        }
      } else {
        detectionMap.get(detId)!.event_id = event.id
      }
    }
  }

  const allForClustering = [...detectionMap.values()]
  const clusterTargetIds = options.force
    ? allForClustering.map((d) => d.id)
    : [...unlinked.map((d) => d.id), ...openEvents.flatMap((e) => e.detection_ids)]

  const uniqueTargetIds = [...new Set(clusterTargetIds)]
  const targetDetections = uniqueTargetIds
    .map((id) => detectionMap.get(id))
    .filter((d): d is ClusterDetection => Boolean(d))

  let pairs: Array<{ id_a: string; id_b: string }> = []
  try {
    pairs = await fetchNeighborPairs(targetDetections.map((d) => d.id))
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'Error en vecinos PostGIS')
    for (let i = 0; i < targetDetections.length; i++) {
      for (let j = i + 1; j < targetDetections.length; j++) {
        if (
          areConnected(
            targetDetections[i],
            targetDetections[j],
            CLUSTER_CONFIG.distanceThresholdM,
            CLUSTER_CONFIG.timeThresholdHours,
          )
        ) {
          const a = targetDetections[i].id
          const b = targetDetections[j].id
          pairs.push(a < b ? { id_a: a, id_b: b } : { id_a: b, id_b: a })
        }
      }
    }
  }

  const components = buildConnectedComponents(targetDetections, pairs)
  metrics.clusters_found = components.size

  const allMerges: MergePlan[] = []
  const allConflicts: ConfirmedConflict[] = []
  const pendingReview = new Set<string>()
  const eventsToUpdate = new Set<string>()
  const dryClusters: ClusterDryRunCluster[] = []
  const writePlan: ClusterWritePlanItem[] = []

  let clusterIndex = 0
  for (const members of components.values()) {
    clusterIndex++
    const sortedMembers = [...members].sort(
      (a, b) =>
        new Date(a.acquired_at_utc).getTime() - new Date(b.acquired_at_utc).getTime(),
    )
    const detIds = sortedMembers.map((m) => m.id).sort()
    const detToEvents = mapDetectionsToEvents(sortedMembers, events)
    const { merges, conflicts, involvedEventIds } = resolveEventMerges(
      detIds,
      events,
      detToEvents,
    )

    allMerges.push(...merges)
    allConflicts.push(...conflicts)

    for (const c of conflicts) pendingReview.add(c.detection_id)

    const hasBlockingConflict = conflicts.length > 0
    const scored = scoreCluster(
      sortedMembers.filter((m) => !pendingReview.has(m.id)),
      involvedEventIds.length === 0,
    )

    let proposedAction: ClusterDryRunCluster['proposed_action'] = 'create'
    let existingEventId: string | undefined

    if (!hasBlockingConflict) {
      if (merges.length > 0) {
        proposedAction = 'merge'
        existingEventId = merges[0].survivor_event_id
        metrics.events_merged++
        metrics.events_absorbed += merges[0].absorbed_event_ids.length
      } else if (involvedEventIds.length === 1) {
        proposedAction = 'update'
        existingEventId = involvedEventIds[0]
        eventsToUpdate.add(existingEventId)
      } else if (involvedEventIds.length === 0) {
        proposedAction = 'create'
      }

      const isNew = proposedAction === 'create'
      const eventRow = scoredToEventRow(scored, isNew)

      if (proposedAction === 'merge' && merges[0]) {
        writePlan.push({
          action: 'merge',
          detection_ids: detIds,
          event_id: merges[0].survivor_event_id,
          absorbed_event_ids: merges[0].absorbed_event_ids,
          event: eventRow,
        })
      } else if (proposedAction === 'update' && existingEventId) {
        writePlan.push({
          action: 'update',
          detection_ids: detIds,
          event_id: existingEventId,
          event: scoredToEventRow(scored, false),
        })
      } else if (proposedAction === 'create') {
        writePlan.push({
          action: 'create',
          detection_ids: detIds,
          event: eventRow,
        })
      }
    } else {
      proposedAction = 'create'
      metrics.confirmed_event_conflicts += conflicts.length
    }

    const first = sortedMembers[0].acquired_at_utc
    const last = sortedMembers[sortedMembers.length - 1].acquired_at_utc
    const timeSpan =
      (new Date(last).getTime() - new Date(first).getTime()) / 3_600_000

    dryClusters.push({
      cluster_index: clusterIndex,
      detection_ids: detIds,
      members: sortedMembers.map((m) => ({
        id: m.id,
        lat: m.latitude,
        lng: m.longitude,
        acquired_at_utc: m.acquired_at_utc,
        source_product: m.source_product,
        satellite_normalized: m.satellite_normalized,
        department_name: m.department_name,
      })),
      max_internal_distance_m_approx: maxInternalDistanceM(sortedMembers),
      time_span_hours: Math.round(timeSpan * 100) / 100,
      satellites: [...new Set(sortedMembers.map((m) => m.satellite_normalized))].sort(),
      department: scored.department_id ? scored.department_names[0] ?? null : null,
      cross_department: scored.cross_department,
      validation_status: scored.validation_status,
      risk_level: scored.risk_level,
      priority_score: scored.priority_score,
      proposed_action: hasBlockingConflict ? 'create' : proposedAction,
      existing_event_id: existingEventId,
      merge_plans: merges.length ? merges : undefined,
    })

    if (!hasBlockingConflict) {
      if (proposedAction === 'create') metrics.events_created++
      if (proposedAction === 'update') metrics.events_updated++
      metrics.detections_newly_linked += detIds.filter((id) => !linkedIds.has(id)).length
      if (sortedMembers.length === 1) metrics.single_detection_events++
      else metrics.multi_detection_events++
      if (scored.satellite_count >= 2) metrics.multisatellite_events++
      if (scored.cross_department) metrics.cross_department_events++
    }
  }

  for (const event of openEvents) {
    eventsToUpdate.add(event.id)
  }

  metrics.detections_pending_review = pendingReview.size
  metrics.unlinked_detections = detections.filter(
    (d) =>
      !linkedIds.has(d.id) &&
      !dryClusters.some((c) => c.detection_ids.includes(d.id) && !c.merge_plans) &&
      !pendingReview.has(d.id),
  ).length
  metrics.errors = errors
  metrics.duration_ms = Date.now() - start

  const result: ClusterDryRunResult = {
    dry_run: options.dryRun !== false,
    clusters: dryClusters,
    merges: allMerges,
    confirmed_conflicts: allConflicts,
    events_to_update: [...eventsToUpdate].sort(),
    detections_pending_review: [...pendingReview],
    metrics,
    write_plan: writePlan,
  }

  if (options.dryRun === false && writePlan.length > 0) {
    const commitResult = await commitClusterBatch(writePlan)
    const refreshed = await refreshEventTemporalStatus()
    metrics.events_created = commitResult.events_created
    metrics.events_updated = commitResult.events_updated + refreshed
    metrics.events_merged = commitResult.events_merged
    metrics.events_absorbed = commitResult.events_absorbed
    metrics.detections_newly_linked = commitResult.detections_linked
    result.dry_run = false
  } else if (options.dryRun === false) {
    metrics.events_updated = await refreshEventTemporalStatus()
    result.dry_run = false
  }

  return result
}
