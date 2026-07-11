/** Thermal activity plugin — detail sections metadata. */
import type { EventDetailSection } from '@/modules/environmental-events/manifest/event-manifest'

export const thermalDetailSections: EventDetailSection[] = [
  { id: 'evidence', title: 'Evidencia térmica' },
  { id: 'interpretation', title: 'Interpretación' },
  { id: 'protected_area_context', title: 'Áreas protegidas' },
  { id: 'land_cover_context', title: 'Cobertura del suelo' },
  { id: 'population_context', title: 'Población' },
  { id: 'climate_context', title: 'Clima' },
  { id: 'biodiversity_context', title: 'Biodiversidad' },
]
