# Phase 5 — Operational Empty States & Field Experience Audit

Base: Phase 4 complete (`750decf`).

## Objective

Every empty screen explains meaning, origin, user action, and distinguishes error / permission / feature-disabled / filter-empty.

## Screen audit summary

| Screen | Before | After | Classification |
|--------|--------|-------|----------------|
| Missions list | Partial OperationalEmptyState | Tab-aware + demo note via canonical counts | good |
| Assignments | Partial | No assignments pending copy + CTAs | good |
| Field home | Zero metrics grid | Empty state + connectivity/storage only | good |
| Field packages | Plain paragraph | OperationalEmptyState + feature disabled | good |
| Field evidence pending | Plain paragraph | OperationalEmptyState + sync note | good |
| Field sync | Silent empty list | Empty state; controls hidden without bundles | good |
| Field conflicts | Plain + demo fixtures | OperationalEmptyState; fixtures removed | good |
| Verifications | No list empty | Needs / legacy / filter empty | good |
| Evidence (mission) | "Sin evidencia recibida" | OperationalEmptyState | good |
| Resolution embed | Returned null | Pending resolution empty state | good |
| Response list | Generic empty | Filter vs no operational incidents | good |
| Findings / Priorities | Filter-only message | FilterEmptyState vs system empty | good |
| Incidents | Generic empty | Operational + legacy count note | good |
| Reports hub | Cards only | Empty saved reports + conditional incident report | good |
| Admin members/invites | Empty `<ul>` | OperationalEmptyState + CTAs | good |
| Integrations | Stub badges | Product copy, no secrets | good |

## Components delivered

- `OperationalEmptyState` — extended props (status, compact, primaryAction, supplementalNote)
- `OperationalErrorState` — retry + admin technical detail
- `OperationalLoadingSkeleton` — list/detail/card
- `FilterEmptyState`, `PermissionDeniedState`, `FeatureDisabledState`
- `useCanonicalOperationalCounts` — ExecutiveMetricsService breakdown

## Gaps (Phase 6+)

- Full role-matrix page tests in routing
- Map-specific skeleton on all map views
- Validation queue standalone page

## Performance

- Canonical counts: single React Query (`executive-metrics`, 30s stale)
- Loading skeletons prevent premature empty states
