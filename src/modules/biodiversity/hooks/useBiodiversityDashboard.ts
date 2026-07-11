import { useQuery } from '@tanstack/react-query'
import { useAuthQueryReady } from '@/core/auth/use-auth-query-ready'
import { biodiversityApi } from '@/modules/biodiversity/api/biodiversity-api'
import type { BiodiversityDashboardFilters } from '@/modules/biodiversity/types/biodiversity-dashboard.types'

export function useBiodiversityDashboard(filters: BiodiversityDashboardFilters) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['biodiversity', 'dashboard', filters],
    queryFn: () => biodiversityApi.getDashboardSummary(filters),
    staleTime: 60_000,
    refetchInterval: authReady ? 120_000 : false,
    retry: 2,
    enabled: authReady,
  })
}

export function useBiodiversityNationalSummary() {
  const authReady = useAuthQueryReady()
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
    refetchInterval: authReady ? 180_000 : false,
    retry: 2,
    enabled: authReady,
  })
}

export function useBiodiversityZoneDetail(
  zoneCode: string | undefined,
  filters: BiodiversityDashboardFilters,
) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['biodiversity', 'zone', zoneCode, filters],
    queryFn: () => biodiversityApi.getZoneSummary(zoneCode!, filters),
    enabled: authReady && Boolean(zoneCode),
    staleTime: 60_000,
    retry: 2,
  })
}

export function useBiodiversityHealth() {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['biodiversity', 'health'],
    queryFn: () => biodiversityApi.getHealth(),
    staleTime: 120_000,
    retry: 1,
    enabled: authReady,
  })
}

export function useBiodiversityVisualSummary(filters: BiodiversityDashboardFilters) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['biodiversity', 'visual', filters],
    queryFn: () => biodiversityApi.getVisualSummary(filters),
    staleTime: 120_000,
    retry: 2,
    enabled: authReady,
  })
}

export function useBiodiversityVisualDetail(
  source: string | undefined,
  occurrenceId: string | undefined,
  filters: BiodiversityDashboardFilters,
) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['biodiversity', 'visual-detail', source, occurrenceId, filters],
    queryFn: () => biodiversityApi.getVisualDetail(source!, occurrenceId!, filters),
    enabled: authReady && Boolean(source && occurrenceId),
    staleTime: 120_000,
    retry: 1,
  })
}
