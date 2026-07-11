import { useQuery } from '@tanstack/react-query'
import { useAuthQueryReady } from '@/core/auth/use-auth-query-ready'
import { fireApi } from '@/modules/fires/api/fire-api'
import { FIRE_SUMMARY_WINDOW_HOURS } from '@/modules/fires/config/fire.constants'
import { FIRE_PERIOD_PRESETS, type FirePeriodPreset } from '@/modules/fires/config/fire.constants'

export function useFireSummary(windowHours: number = FIRE_SUMMARY_WINDOW_HOURS) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['fires', 'summary', windowHours],
    queryFn: () =>
      fireApi.getSummary(
        windowHours !== FIRE_SUMMARY_WINDOW_HOURS ? windowHours : undefined,
      ),
    refetchInterval: authReady ? 60_000 : false,
    staleTime: 30_000,
    retry: 2,
    enabled: authReady,
  })
}

export function useFireSummaryForPeriod(period: FirePeriodPreset) {
  return useFireSummary(FIRE_PERIOD_PRESETS[period])
}
