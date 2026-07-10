import { useQuery } from '@tanstack/react-query'
import { biodiversityApi } from '@/modules/biodiversity/api/biodiversity-api'
import type { BiodiversityDashboardFilters } from '@/modules/biodiversity/types/biodiversity-dashboard.types'

export function useBiodiversityDashboard(filters: BiodiversityDashboardFilters) {
  return useQuery({
    queryKey: ['biodiversity', 'dashboard', filters],
    queryFn: () => biodiversityApi.getDashboardSummary(filters),
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 2,
  })
}

export function useBiodiversityNationalSummary() {
  return useQuery({
    queryKey: ['biodiversity', 'national-summary'],
    queryFn: () =>
      biodiversityApi.getDashboardSummary({
        period: '5y',
        source: 'all',
        taxon: 'all',
        quality: 'all',
        zone: 'all',
      }),
    staleTime: 60_000,
    refetchInterval: 180_000,
    retry: 2,
  })
}

export function useBiodiversityZoneDetail(
  zoneCode: string | undefined,
  filters: BiodiversityDashboardFilters,
) {
  return useQuery({
    queryKey: ['biodiversity', 'zone', zoneCode, filters],
    queryFn: () => biodiversityApi.getZoneSummary(zoneCode!, filters),
    enabled: Boolean(zoneCode),
    staleTime: 60_000,
    retry: 2,
  })
}

export function useBiodiversityHealth() {
  return useQuery({
    queryKey: ['biodiversity', 'health'],
    queryFn: () => biodiversityApi.getHealth(),
    staleTime: 120_000,
    retry: 1,
  })
}

export function useBiodiversityVisualSummary(filters: BiodiversityDashboardFilters) {
  return useQuery({
    queryKey: ['biodiversity', 'visual', filters],
    queryFn: () => biodiversityApi.getVisualSummary(filters),
    staleTime: 120_000,
    retry: 2,
  })
}

export function useBiodiversityVisualDetail(
  source: string | undefined,
  occurrenceId: string | undefined,
  filters: BiodiversityDashboardFilters,
) {
  return useQuery({
    queryKey: ['biodiversity', 'visual-detail', source, occurrenceId, filters],
    queryFn: () => biodiversityApi.getVisualDetail(source!, occurrenceId!, filters),
    enabled: Boolean(source && occurrenceId),
    staleTime: 120_000,
    retry: 1,
  })
}
