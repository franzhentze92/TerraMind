export type TelemetryEvent =
  | { type: 'page_view'; module: string; path: string }
  | { type: 'copilot_query'; questionId: string }
  | { type: 'source_health_check'; source: string; status: string }
  | { type: 'error'; message: string; module?: string }

export function trackEvent(event: TelemetryEvent): void {
  if (import.meta.env.DEV) {
    console.debug('[telemetry]', event)
  }
}
