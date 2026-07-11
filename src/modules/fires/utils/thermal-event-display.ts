import type { FireEventListItemDto } from '@/modules/fires/types/fire.dto'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'

/**
 * Deterministic, human-readable thermal event title.
 * Never uses raw IDs; location + first observation anchor the name.
 */
export function buildThermalEventDisplayName(
  event: Pick<
    FireEventListItemDto,
    'department_name' | 'first_detected_at' | 'validation_status'
  >,
): string {
  const location = event.department_name?.trim() || 'ubicación pendiente'
  const observed = formatGuatemalaDateTime(event.first_detected_at)
  if (event.validation_status === 'confirmado') {
    return `Incendio verificado · ${location} · ${observed}`
  }
  return `Evento térmico · ${location} · ${observed}`
}
