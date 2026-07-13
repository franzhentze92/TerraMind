import type { EnvironmentalEventType } from '@/modules/environmental-events/types/taxonomy'

/**
 * Detail route for an event. Thermal keeps its rich `/incendios` experience;
 * every other registered type uses the generic `/eventos/:id` page. Registry
 * grows automatically — no per-type UI branching beyond the thermal legacy path.
 */
export function eventDetailHref(type: EnvironmentalEventType, id: string): string {
  if (type === 'thermal_activity') return `/incendios/${id}`
  return `/eventos/${id}`
}
