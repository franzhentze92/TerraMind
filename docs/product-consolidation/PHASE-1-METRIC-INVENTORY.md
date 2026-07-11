# Product Consolidation — Phase 1: Metric Inventory & Operational Truth

Machine-readable inventory: [`src/modules/executive-metrics/metric-registry.ts`](../../src/modules/executive-metrics/metric-registry.ts).
Canonical resolver: [`server/services/executive-metrics.service.ts`](../../server/services/executive-metrics.service.ts).
Audit gate: `npm run product-truth:audit`.

This document records the initial audit (where every visible count came from),
the contradictions found, how they were resolved, and the canonical policies now
enforced.

---

## 1. Canonical taxonomy

Defined once in [`metric-taxonomy.ts`](../../src/modules/executive-metrics/metric-taxonomy.ts):

- **Scope**: `national` · `organization` · `user` · `mission` · `incident` · `demo`
- **Classification**: `operational` · `legacy` · `demo` · `pending` · `excluded` · `unresolved_ownership`
- **Ownership**: `tenant_owned` · `global_public_data` · `legacy_unowned` · `demo_owned` · `system_internal`
- **Time windows**: `24h` · `48h` · `7d` · `30d` · `all_time` · `current_state`

Forbidden variants (`real`, `prod`, `test`, `pilot_only`, `legacy_only`, `tenant`,
`internal_demo`) are rejected by the audit outside internal adapters.

Visible terminology is centralized in
[`src/shared/product-language.ts`](../../src/shared/product-language.ts). Internal
phase codes (`8B.5`, `8C.1`, …) are forbidden in UI copy and checked by the audit.

Dates are presented only through
[`src/shared/time/presentation.ts`](../../src/shared/time/presentation.ts)
(`America/Guatemala`, `es-GT`).

---

## 2. Contradictions found (initial audit) and how they were resolved

| # | Contradiction (before) | Root cause | Resolution |
|---|---|---|---|
| 1 | 97 observaciones / 38 detecciones / 14 eventos narrated as one funnel | Three different measurement bases (last-run raw rows vs windowed inside-GT detections vs windowed events) | Three distinct, explicitly labelled metrics: `fire_observations` (Observaciones recibidas), `fire_detections_national` (Detecciones dentro de Guatemala), `fire_events` (Eventos térmicos agrupados) — each declares the `48h` window. |
| 2 | "Observaciones FIRMS" meant `rows_received` in Fires but `count(fire_detections)` on the dashboard | Same label, two sources | Executive Metrics Service reuses `getFireSummary` (the Fires module source) so numbers match everywhere. |
| 3 | Incidentes: summary said 4, KPI said 0 | `incidents_total` (all rows) vs `incidents_tenant` (org-scoped); all 4 rows are legacy (null org) | Headline `incidents_operational` = organization only; `legacy` shown as an excluded breakdown slice ("Legacy sin organización: 4 · ownership pendiente"). |
| 4 | Hallazgos / Prioridades = 0 for normal users but nonzero on dashboard | National tables (`composite_findings`, `finding_priority_assessments`) have no `organization_id` but were run through `filterRowsByActiveOrganization` | National data is `global_public_data`; tenant filter removed from `listFindings` / `listPriorities` (gated by permission instead). Now list counts match the dashboard. |
| 5 | Misiones: 2 piloto exist but KPI = 0 | Demo filtered by mission title; counts not tenant-scoped consistently | `missions_operational` excludes demo/legacy; `demo` shown as a separate breakdown slice, never summed silently. |
| 6 | Evidencia: 1 piloto exists but KPI = 0 | Pilot inherited from owning mission title | `evidence_operational` excludes pilot; `demo` shown in breakdown. |
| 7 | Verificaciones: 4 planes / 0 needs | Plans list is model-version-agnostic; needs only from active current-model plan; `not_required` plans have 0 needs | `verification_plans_legacy` (legacy = old model / unowned) vs `verification_needs_active` (unresolved needs of operational plans). |
| 8 | Response assessments = 0 with no explanation | `response_assessments.organization_id NOT NULL`: legacy/demo never generate assessments | `response_assessments` metric carries the limitation text explaining this. |
| 9 | Reports (HTML/PDF) counts diverged from dashboard (capped slice lengths) | Report prose used `array.length` of capped slices | Reports embed `canonical_metrics` and print the same values; PDF "Indicadores nacionales" uses canonical metrics with breakdown. |

---

## 3. Demo policy

Demo is **excluded by default** from all operational values. When `include_demo=true`:

- operational values are **not** mutated (enforced by test + audit);
- a visible banner is shown;
- demo appears only as a separate `demo`-classified breakdown slice;
- reports are classified `internal_demo`.

## 4. Legacy policy

Legacy data is visible to authorized users but **excluded from operational KPIs**.
It appears in the breakdown with an `ownership pendiente` reason and never generates
assessments, decisions or missions.

---

## 5. Registered metrics

The full machine-readable inventory (with `source_table_or_service`, `scope`,
`ownership_policy`, `demo_policy`, `legacy_policy`, `time_window`, `status_filter`,
`deduplication_rule`, `unit`, `last_updated_source`, `confidence_or_limitations`) lives in
`metric-registry.ts`. Summary:

| metric_id | label | scope | window |
|---|---|---|---|
| fire_observations | Observaciones recibidas | national | 48h |
| fire_detections_national | Detecciones dentro de Guatemala | national | 48h |
| fire_events | Eventos térmicos agrupados | national | 48h |
| fire_events_attention | Eventos con atención | national | 48h |
| findings_active | Hallazgos activos | national | current_state |
| findings_monitoring | Hallazgos en monitoreo | national | current_state |
| findings_resolved | Hallazgos resueltos | national | current_state |
| findings_total | Hallazgos totales | national | current_state |
| priorities_total | Prioridades evaluadas | national | current_state |
| incidents_operational | Incidentes operacionales | organization | current_state |
| incidents_legacy | Incidentes legacy | national | current_state |
| missions_operational | Misiones operacionales | organization | current_state |
| missions_demo | Misiones de demostración interna | demo | current_state |
| evidence_operational | Evidencia operacional | organization | current_state |
| evidence_demo | Evidencia de piloto interno | demo | current_state |
| verification_plans_legacy | Planes de verificación legacy | national | current_state |
| verification_needs_active | Necesidades de verificación activas | incident | current_state |
| response_assessments | Evaluaciones de respuesta | organization | current_state |
| sources_active | Fuentes activas | national | current_state |

---

## 6. Canonical API

- `GET /api/executive/metrics?scope=&include_demo=&include_legacy=`
- `GET /api/executive/metrics/:metricId`
- `GET /api/executive/data-quality-summary`

Protected by `findings.view` + tenant isolation. Registered in
`server/auth/route-registry.ts`.

Every metric response includes: value, breakdown, scope, classification, time
window, source, limitations and `lastUpdatedAt`.

---

## 7. Listings (classification surfaced, no redesign)

Per §13, listings now surface data classification without a card redesign:

- **Incidents** — each row carries a `classification` (`operational` / `legacy` /
  `demo` / `out_of_scope`) from `listIncidentsDto`; the UI renders a
  `ClassificationBadge`. Legacy rows are no longer silently dropped for
  non-admins (root cause of the "4 vs 0" contradiction) — they are shown and
  badged `Legacy`.
- **Findings / Priorities** — national `global_public_data`; tenant filter
  removed so list counts equal the dashboard.

`ClassificationBadge` (`src/modules/executive-metrics/components/ClassificationBadge.tsx`)
is the shared, reusable badge; labels come from `product-language.ts`.

## 8. Tests & audit

- `server/services/executive-metrics.service.test.ts` — consistency rules
  (observations ≠ detections, incidents operational/legacy split, missions/evidence
  demo policy, include_demo immutability, legacy excluded from operational,
  verification 4/0, response 0, zero states, data quality), determinism, and the
  **automated dashboard == report** comparison (§12): every KPI the national
  report prints via `reportMetricValue` equals the dashboard's canonical value,
  and enabling demo never changes it.
- `src/modules/executive-metrics/metric-registry.test.ts` — registry/taxonomy/
  product-language invariants and phase-code detection.
- `npm run product-truth:audit` — CI gate (253 checks) enforcing all of the above.

## 9. Out of scope (Phase 1)

No UI redesign, no new engines, no 8C.2, no new providers, no legacy ownership
backfill, no billing, no external alerts.
