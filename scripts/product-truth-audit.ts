#!/usr/bin/env tsx
/**
 * product-truth:audit — Product Consolidation Phase 1 consistency gate.
 *
 * Fails (exit 1) if any KPI-consistency rule is violated:
 *  - a metric emitted by the service is not registered;
 *  - a registered metric omits time window / source / breakdown policy;
 *  - demo is summed without separation;
 *  - legacy is summed as operational;
 *  - a metric declares no period;
 *  - an internal phase code appears in a visible label;
 *  - a KPI has no breakdown;
 *  - dashboard and report metric assembly diverge.
 *
 * Runs against pure builders with a synthetic context — no database required.
 */
import { config } from 'dotenv'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'

import { METRIC_REGISTRY, isRegisteredMetric } from '@/modules/executive-metrics/metric-registry'
import {
  DATA_CLASSIFICATIONS,
  FORBIDDEN_CLASSIFICATION_VARIANTS,
  METRIC_SCOPES,
  OWNERSHIP_CLASSES,
  TIME_WINDOW_KEYS,
} from '@/modules/executive-metrics/metric-taxonomy'
import {
  CLASSIFICATION_LABELS,
  OWNERSHIP_LABELS,
  PRODUCT_LANGUAGE,
  SCOPE_LABELS,
  findInternalPhaseCodes,
} from '@/shared/product-language'
import {
  buildDataQualityFromContext,
  buildExecutiveMetricsFromContext,
  type ResolvedContext,
} from '../server/services/executive-metrics.service.js'

config({ path: resolve(process.cwd(), '.env') })

const failures: string[] = []
const passes: string[] = []
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) passes.push(name)
  else failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
}

function syntheticContext(): ResolvedContext {
  return {
    fire: {
      observations_downloaded: 97,
      detections_count: 38,
      events_count: 14,
      attention_events_count: 3,
      window_start_utc: '2026-07-08T00:00:00.000Z',
      window_end_utc: '2026-07-10T00:00:00.000Z',
      generated_at: '2026-07-10T00:00:00.000Z',
    },
    incidents: { operational: 0, legacy: 4, demo: 1, outOfScope: 0 },
    missions: { operational: 0, legacy: 0, demo: 2, outOfScope: 0 },
    evidence: { operational: 0, legacy: 0, demo: 1, outOfScope: 0 },
    findingsActive: 50,
    findingsMonitoring: 5,
    findingsResolved: 2,
    findingsTotal: 57,
    priorities: 12,
    verificationPlansLegacy: 4,
    verificationNeedsActive: 0,
    responseAssessments: 0,
    sourcesActive: 1,
    lastSyncAt: '2026-07-10T00:00:00.000Z',
  }
}

// 1. Registry integrity
for (const m of METRIC_REGISTRY) {
  check(`registry:${m.metric_id}:scope`, (METRIC_SCOPES as readonly string[]).includes(m.scope))
  check(
    `registry:${m.metric_id}:ownership`,
    (OWNERSHIP_CLASSES as readonly string[]).includes(m.ownership_policy),
  )
  check(
    `registry:${m.metric_id}:time_window`,
    (TIME_WINDOW_KEYS as readonly string[]).includes(m.time_window),
    'metric declares no valid period',
  )
  check(`registry:${m.metric_id}:source`, m.source_table_or_service.trim().length > 0, 'no source')
}

// 2. Forbidden variants must not appear as scope/ownership values
for (const m of METRIC_REGISTRY) {
  check(
    `no-forbidden-variant:${m.metric_id}`,
    !FORBIDDEN_CLASSIFICATION_VARIANTS.includes(m.scope as unknown as string) &&
      !FORBIDDEN_CLASSIFICATION_VARIANTS.includes(m.ownership_policy as unknown as string),
  )
}

// 3. No internal phase code in any visible label
const visibleLabels = [
  ...Object.values(PRODUCT_LANGUAGE),
  ...Object.values(SCOPE_LABELS),
  ...Object.values(CLASSIFICATION_LABELS),
  ...Object.values(OWNERSHIP_LABELS),
  ...METRIC_REGISTRY.map((m) => m.label),
  ...METRIC_REGISTRY.map((m) => m.description),
]
for (const label of visibleLabels) {
  const codes = findInternalPhaseCodes(label)
  check(`no-phase-code:"${label.slice(0, 32)}"`, codes.length === 0, codes.join(', '))
}

// 4. Every classification has a label
for (const c of DATA_CLASSIFICATIONS) {
  check(`classification-label:${c}`, Boolean(CLASSIFICATION_LABELS[c]))
}

// 5. Service emits only registered metrics, each with period + breakdown; demo/legacy never summed
const ctx = syntheticContext()
const metricsDefault = buildExecutiveMetricsFromContext(ctx, { include_demo: false })
const metricsDemo = buildExecutiveMetricsFromContext(ctx, { include_demo: true })

for (const m of metricsDefault) {
  check(`emitted-registered:${m.id}`, isRegisteredMetric(m.id), 'metric not registered')
  check(`emitted-period:${m.id}`, m.timeWindow.label.trim().length > 0, 'no period label')
  check(`emitted-breakdown:${m.id}`, m.breakdown.length > 0, 'KPI has no breakdown')
  check(`emitted-source:${m.id}`, m.source.trim().length > 0, 'no documented source')
  // headline value must equal the sum of INCLUDED breakdown slices (no legacy/demo summed in)
  const includedSum = m.breakdown.filter((b) => b.included).reduce((a, b) => a + b.value, 0)
  check(
    `operational-sum:${m.id}`,
    includedSum === m.value,
    `value ${m.value} != included sum ${includedSum} (legacy/demo may be summed as operational)`,
  )
}

// 6. include_demo must not mutate operational values
for (const m of metricsDefault) {
  const demoVersion = metricsDemo.find((x) => x.id === m.id)
  check(
    `include-demo-immutable:${m.id}`,
    demoVersion != null && demoVersion.value === m.value,
    'include_demo changed the operational value',
  )
}

// 7. Data quality summary is well-formed
const dq = buildDataQualityFromContext(ctx)
check('data-quality:fields', typeof dq.operationalRecords === 'number' && Array.isArray(dq.warnings))
check('data-quality:legacy-separated', dq.legacyRecords >= 0 && dq.demoRecords >= 0)

// 8. Reports must consume the canonical metric source (no divergent recomputation)
try {
  const reportsSrc = readFileSync(
    resolve(process.cwd(), 'server/services/reports.service.ts'),
    'utf8',
  )
  check(
    'reports-consume-canonical',
    reportsSrc.includes('getExecutiveMetrics') && reportsSrc.includes('canonical_metrics'),
    'reports.service.ts does not consume the Executive Metrics Service',
  )
} catch (err) {
  check('reports-consume-canonical', false, String(err))
}

// 9. Endpoints are registered in the route registry
try {
  const registrySrc = readFileSync(resolve(process.cwd(), 'server/auth/route-registry.ts'), 'utf8')
  check('endpoint:metrics', registrySrc.includes("'/api/executive/metrics'"))
  check('endpoint:metric-detail', registrySrc.includes("'/api/executive/metrics/:metricId'"))
  check(
    'endpoint:data-quality',
    registrySrc.includes("'/api/executive/data-quality-summary'"),
  )
} catch (err) {
  check('endpoints-registered', false, String(err))
}

// --- Report ---------------------------------------------------------------
console.log('\n=== product-truth:audit ===')
console.log(`Checks passed: ${passes.length}`)
console.log(`Checks failed: ${failures.length}`)
if (failures.length > 0) {
  console.error('\nFailures:')
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log('\nProduct Consolidation Phase 1 — Operational Truth & KPI Consistency: audit OK')
process.exit(0)
