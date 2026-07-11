/**
 * Canonical metric contracts for the Executive Metrics Service.
 *
 * Product Consolidation — Phase 1. These shapes are what /api/executive/*
 * returns and what Situación Nacional, cards and reports consume. Every count
 * a user sees must be expressed as an ExecutiveMetric so it carries its scope,
 * classification, time window, breakdown, source and limitations.
 */

import type {
  DataClassification,
  MetricScope,
  TimeWindowKey,
} from '@/modules/executive-metrics/metric-taxonomy'

/** One line of a metric breakdown (operational / legacy / demo / pending ...). */
export interface MetricBreakdownItem {
  label: string
  value: number
  /** Whether this slice is included in the metric's headline `value`. */
  included: boolean
  classification: DataClassification
  /** Why the slice is excluded (key into EXCLUSION_REASON_LABELS), when included=false. */
  reason?: string
}

export interface MetricTimeWindow {
  key: TimeWindowKey
  label: string
  from?: string | null
  to?: string | null
}

/** Canonical resolved metric. */
export interface ExecutiveMetric {
  id: string
  label: string
  value: number
  scope: MetricScope
  classification: DataClassification
  timeWindow: MetricTimeWindow
  breakdown: MetricBreakdownItem[]
  source: string
  lastUpdatedAt?: string | null
  limitations: string[]
}

export interface ExecutiveMetricsResponse {
  generated_at: string
  scope: MetricScope
  include_demo: boolean
  include_legacy: boolean
  metrics: ExecutiveMetric[]
}

/** Data quality rollup shown compactly on Situación Nacional (spec §10). */
export interface DataQualitySummary {
  operationalRecords: number
  legacyRecords: number
  demoRecords: number
  unresolvedOwnershipRecords: number
  pendingProcessingRecords: number
  freshnessStatus: 'fresh' | 'delayed' | 'stale'
  lastSuccessfulUpdateAt?: string | null
  warnings: string[]
}
