/**
 * Visual model for "Línea de inteligencia" rows.
 *
 * Icons and accent colors come from the environmental-event registry when the
 * milestone text maps to a known type — the same source used on the national map.
 */
import type { NationalTimelineEntry } from '@/modules/executive-demo/types/executive-demo.types'
import { environmentalEventRegistry } from '@/modules/environmental-events/registry/event-type-registry'
import { ensureEventsRegistered } from '@/modules/environmental-events/registry/register-all'
import type { EnvironmentalEventType } from '@/modules/environmental-events/types/taxonomy'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  BadgeCheck,
  ClipboardList,
  Lightbulb,
  ShieldAlert,
  Target,
} from 'lucide-react'
import { EventTypeIcon, resolveEventTypeIcon } from '@/modules/environmental-events/ui/EventTypeIcon'
import { timelineEntryTitle } from './timeline-title'

export interface TimelineEntryVisual {
  iconKey: string
  accentColor: string
  iconClassName: string
  /** When set, prefer EventTypeIcon (registry / map parity). */
  eventType?: EnvironmentalEventType
  /** Operational milestone icon when not an environmental event type. */
  fallbackIcon?: LucideIcon
}

const STAGE_FALLBACK: Record<string, Omit<TimelineEntryVisual, 'eventType'>> = {
  observation: {
    iconKey: 'flame',
    accentColor: '#f97316',
    iconClassName: 'bg-orange-500/20 text-[#fb923c]',
    fallbackIcon: Activity,
  },
  event: {
    iconKey: 'flame',
    accentColor: '#f97316',
    iconClassName: 'bg-orange-500/20 text-[#fb923c]',
  },
  finding: {
    iconKey: 'leaf',
    accentColor: '#86efac',
    iconClassName: 'bg-emerald-500/20 text-[#86efac]',
    fallbackIcon: Lightbulb,
  },
  priority: {
    iconKey: 'leaf',
    accentColor: '#86efac',
    iconClassName: 'bg-emerald-500/20 text-[#86efac]',
    fallbackIcon: Target,
  },
  incident: {
    iconKey: 'waves',
    accentColor: '#38bdf8',
    iconClassName: 'bg-sky-500/20 text-sky-300',
    fallbackIcon: ShieldAlert,
  },
  verification: {
    iconKey: 'activity',
    accentColor: '#60a5fa',
    iconClassName: 'bg-sky-500/20 text-sky-300',
    fallbackIcon: BadgeCheck,
  },
  mission: {
    iconKey: 'activity',
    accentColor: '#60a5fa',
    iconClassName: 'bg-sky-500/20 text-sky-300',
    fallbackIcon: ClipboardList,
  },
}

function inferEventType(summary: string, stage: string): EnvironmentalEventType | null {
  const text = summary.toLowerCase()

  if (
    text.includes('déficit') &&
    (text.includes('precipitación') || text.includes('precipitacion') || text.includes('lluvia'))
  ) {
    return 'rainfall_deficit'
  }
  if (text.includes('sequía') || text.includes('sequia')) return 'rainfall_deficit'

  if (
    text.includes('térmic') ||
    text.includes('termic') ||
    text.includes('incendio') ||
    text.includes('firms') ||
    stage === 'observation'
  ) {
    return 'thermal_activity'
  }

  if (text.includes('inundac') || text.includes('inundación') || text.includes('inundacion')) {
    return 'flood'
  }

  return null
}

function visualFromEventType(type: EnvironmentalEventType): TimelineEntryVisual {
  ensureEventsRegistered()
  const manifest = environmentalEventRegistry.tryGet(type)
  const accentColor = environmentalEventRegistry.getAccentColor(type)
  const iconKey = manifest?.icon ?? 'activity'

  const warm = type === 'thermal_activity'
  const wet = type === 'rainfall_deficit'
  const flood = type === 'flood'

  let iconClassName = 'bg-surface-3/50 text-text-secondary'
  if (warm) iconClassName = 'bg-orange-500/20 text-[#fb923c]'
  if (wet) iconClassName = 'bg-amber-500/20 text-[#f5c518]'
  if (flood) iconClassName = 'bg-sky-500/20 text-sky-300'

  return {
    iconKey,
    accentColor,
    iconClassName,
    eventType: type,
  }
}

export function resolveTimelineEntryVisual(entry: NationalTimelineEntry): TimelineEntryVisual {
  const title = timelineEntryTitle(entry)
  const inferred = inferEventType(title, entry.stage)

  if (inferred === 'flood') {
    return {
      iconKey: 'waves',
      accentColor: '#38bdf8',
      iconClassName: 'bg-sky-500/20 text-sky-300',
    }
  }

  if (inferred && environmentalEventRegistry.has(inferred)) {
    return visualFromEventType(inferred)
  }

  if (title.toLowerCase().includes('verificación') || title.toLowerCase().includes('verificacion')) {
    return { ...STAGE_FALLBACK.verification, eventType: undefined }
  }

  if (
    title.toLowerCase().includes('prioridad') ||
    title.toLowerCase().includes('agrícola') ||
    title.toLowerCase().includes('agricola') ||
    title.toLowerCase().includes('exposición') ||
    entry.stage === 'priority'
  ) {
    return { ...STAGE_FALLBACK.priority, eventType: undefined }
  }

  const stageFallback = STAGE_FALLBACK[entry.stage]
  if (stageFallback) {
    return { ...stageFallback, eventType: entry.stage === 'event' ? 'thermal_activity' : undefined }
  }

  return {
    iconKey: 'activity',
    accentColor: '#9898a4',
    iconClassName: 'bg-surface-3/50 text-text-secondary',
    fallbackIcon: Activity,
  }
}

/** Re-export for tests and consumers that need the lucide component directly. */
export { EventTypeIcon, resolveEventTypeIcon }
