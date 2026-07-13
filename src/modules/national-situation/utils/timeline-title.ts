/**
 * Deterministic titles for the "Línea de inteligencia" milestones.
 *
 * Titles come from the canonical timeline `summary` (which already carries type +
 * location for events, e.g. "Actividad térmica agrupada en Petén", and the real
 * title for findings/incidents/missions). We never invent a location: when the
 * summary is missing we fall back to the milestone label. A small legacy map
 * normalizes older generic wording so titles stay consistent with the UI's
 * "Actividad térmica" vocabulary even against an older backend.
 */
const LEGACY_TITLE_MAP: Record<string, string> = {
  'Evento térmico agrupado': 'Actividad térmica agrupada',
  'Detección térmica registrada': 'Nueva detección térmica',
}

export function timelineEntryTitle(entry: {
  summary?: string | null
  stage_label?: string | null
}): string {
  const summary = entry.summary?.trim()
  if (summary) return LEGACY_TITLE_MAP[summary] ?? summary
  return entry.stage_label?.trim() || 'Actividad registrada'
}
