import {
  CONNECTIVITY_PROBE_MS,
  CONNECTIVITY_PROBE_URL,
  FIELD_REAL_SYNC_ENABLED,
} from '@/modules/field-operations/field-mobile/config/fire-field-mobile.config'
import type { FieldConnectivityState } from '@/modules/field-operations/field-mobile/field-mobile.types'

export interface ConnectivityProbeResult {
  state: FieldConnectivityState
  navigator_online: boolean
  api_reachable: boolean
  latency_ms: number | null
  session_expired: boolean
}

export async function probeFieldConnectivity(input?: {
  fetchFn?: typeof fetch
  sessionExpired?: boolean
  syncInProgress?: boolean
  forceOffline?: boolean
  ignoreNavigator?: boolean
}): Promise<ConnectivityProbeResult> {
  const fetchFn = input?.fetchFn ?? fetch
  const navigatorOnline =
    input?.ignoreNavigator || typeof navigator === 'undefined' ? true : navigator.onLine

  if (input?.sessionExpired) {
    return {
      state: 'session_expired',
      navigator_online: navigatorOnline,
      api_reachable: false,
      latency_ms: null,
      session_expired: true,
    }
  }

  if (input?.syncInProgress) {
    return {
      state: 'sync_in_progress',
      navigator_online: navigatorOnline,
      api_reachable: true,
      latency_ms: null,
      session_expired: false,
    }
  }

  if (input?.forceOffline || !navigatorOnline) {
    return {
      state: 'offline',
      navigator_online: false,
      api_reachable: false,
      latency_ms: null,
      session_expired: false,
    }
  }

  const started = Date.now()
  let apiReachable = false
  let latency: number | null = null

  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    const timer = controller ? setTimeout(() => controller.abort(), CONNECTIVITY_PROBE_MS) : null
    const res = await fetchFn(CONNECTIVITY_PROBE_URL, {
      method: 'GET',
      credentials: 'include',
      signal: controller?.signal,
    })
    if (timer) clearTimeout(timer)
    apiReachable = res.ok
    latency = Date.now() - started
  } catch {
    apiReachable = false
    latency = null
  }

  if (!apiReachable) {
    return {
      state: 'online_no_api',
      navigator_online: true,
      api_reachable: false,
      latency_ms: latency,
      session_expired: false,
    }
  }

  if (latency != null && latency > 2_500) {
    return {
      state: 'slow_network',
      navigator_online: true,
      api_reachable: true,
      latency_ms: latency,
      session_expired: false,
    }
  }

  return {
    state: FIELD_REAL_SYNC_ENABLED ? 'sync_available' : 'sync_available',
    navigator_online: true,
    api_reachable: true,
    latency_ms: latency,
    session_expired: false,
  }
}
