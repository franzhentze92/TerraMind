/**
 * Environmental Event Framework — thermal registration shim (back-compat).
 *
 * Registration is now manifest-driven via `ensureEventsRegistered()`. This shim
 * keeps the historical API (`registerThermalActivity`, `thermalActivityDefinition`)
 * working for existing imports/tests.
 */
import { ensureEventsRegistered } from '@/modules/environmental-events/registry/register-all'
import { thermalActivityManifest } from '@/events/thermal-activity/event.manifest'

export const thermalActivityDefinition = thermalActivityManifest

export function registerThermalActivity(): void {
  ensureEventsRegistered()
}
