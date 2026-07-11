/**
 * Thermal activity plugin — type-specific finding rules (facade).
 *
 * Reusable rules (near population, expanding, persistent, multi-source, …) are
 * NOT copied here; the manifest activates them by id from the shared registry.
 */
export { thermalSpecificFindingRules } from '@/modules/environmental-events/thermal/thermal-finding-rules'
