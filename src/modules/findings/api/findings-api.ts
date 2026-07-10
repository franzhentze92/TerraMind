import { apiClient } from '@/core/api/client'
import type { CompositeFinding } from '@/modules/findings/findings.types'

export interface FindingListItemDto {
  id: string
  finding_type: string
  entity_type: string
  entity_id: string
  title: string
  summary: string
  status: string
  severity_label: string
  confidence_level: string
  department_name: string | null
  source_domains: string[]
  generated_at: string
}

export interface FindingDetailDto extends CompositeFinding {
  department_name: string | null
}

export const findingsApi = {
  list: (params?: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams()
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') search.set(key, String(value))
      }
    }
    const qs = search.toString()
    return apiClient.get<{ items: FindingListItemDto[]; generated_at: string }>(
      `/intelligence/findings${qs ? `?${qs}` : ''}`,
    )
  },

  get: (id: string) => apiClient.get<FindingDetailDto>(`/intelligence/findings/${id}`),

  forFireEvent: (eventId: string) =>
    apiClient.get<{ items: FindingDetailDto[]; generated_at: string }>(
      `/environment/fires/events/${eventId}/findings`,
    ),
}
