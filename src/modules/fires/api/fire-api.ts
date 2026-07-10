import { apiClient } from '@/core/api/client'
import type {
  FireDepartmentOptionDto,
  FireDetectionsGeoJsonDto,
  FireEventDetailDto,
  FireEventsGeoJsonDto,
  FireEventsListDto,
  FirePipelineHealthDto,
  FireSummaryDto,
} from '@/modules/fires/types/fire.dto'

export const fireApi = {
  getSummary: (windowHours?: number) => {
    const qs =
      windowHours !== undefined ? `?window_hours=${windowHours}` : ''
    return apiClient.get<FireSummaryDto>(`/environment/fires/summary${qs}`)
  },

  getDepartments: () =>
    apiClient.get<{ items: FireDepartmentOptionDto[]; generated_at: string }>(
      '/environment/fires/departments',
    ),

  listEvents: (params?: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams()
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') search.set(key, String(value))
      }
    }
    const qs = search.toString()
    return apiClient.get<FireEventsListDto>(
      `/environment/fires/events${qs ? `?${qs}` : ''}`,
    )
  },

  getEvent: (id: string) =>
    apiClient.get<FireEventDetailDto>(`/environment/fires/events/${id}`),

  getEventsGeoJson: (params?: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams()
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '' && key !== 'offset') {
          search.set(key, String(value))
        }
      }
    }
    search.set('limit', '100')
    const qs = search.toString()
    return apiClient.get<FireEventsGeoJsonDto>(
      `/environment/fires/geojson?${qs}`,
    )
  },

  getDetectionsGeoJson: (params?: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams()
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '' && key !== 'offset') {
          search.set(key, String(value))
        }
      }
    }
    search.set('limit', '100')
    const qs = search.toString()
    return apiClient.get<FireDetectionsGeoJsonDto>(
      `/environment/fires/detections/geojson?${qs}`,
    )
  },

  getPipelineHealth: () =>
    apiClient.get<FirePipelineHealthDto>('/environment/fires/pipeline/health'),
}
