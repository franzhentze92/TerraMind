/** Déficit de precipitación — detail sections metadata. */
import type { EventDetailSection } from '@/modules/environmental-events/manifest/event-manifest'

export const rainfallDeficitDetailSections: EventDetailSection[] = [
  { id: 'metrics', title: 'Métricas pluviométricas' },
  { id: 'persistence', title: 'Persistencia' },
  { id: 'territory', title: 'Territorio' },
  { id: 'context', title: 'Contexto agrícola' },
  { id: 'source', title: 'Fuente y producto' },
  { id: 'methodology', title: 'Metodología' },
  { id: 'limitations', title: 'Limitaciones' },
]
