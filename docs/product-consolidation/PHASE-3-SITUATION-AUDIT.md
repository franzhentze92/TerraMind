# Phase 3 — Situación Nacional Executive Redesign Audit

Base commit: `46b608d` (Product Consolidation Phase 2 complete).

This document audits the **pre-Phase-3** `/situacion` page and classifies each block for the redesign.

## Current page structure

**Route:** `/situacion`, alias `/situacion-nacional`  
**Component:** `src/modules/national-center/pages/NationalSituationPage.tsx`

### Layout (pre-Phase-3)

| Zone | Component | Position |
|------|-----------|----------|
| Top bar | `DailyBriefHeaderBar` | Fixed header when FIRMS live |
| Hero | Title + FlyingQuetzal animation | Above fold |
| Left sidebar (xl:2 cols) | `CountryIndicatorsPanel` | Sticky vertical indicators |
| Main (xl:7 cols) | Stacked vertical sections | Requires scroll |
| Right sidebar (xl:3 cols) | `LiveTimelinePanel` | Sticky “Línea de inteligencia” |
| Footer | `SourcesFooter` | Fixed bottom bar |

### Main stack (top → bottom)

1. `ReasoningSequence` — animated pipeline steps  
2. FlyingQuetzal decoration  
3. `FireHeatSummaryCard` — fire domain summary  
4. `NationalMetricsPanel` — **canonical** Phase 1 KPI grid (all registry metrics)  
5. `ExecutiveNationalCommandCenter` — 8C command center (duplicate KPIs, summary, findings, incidents, map, missions, evidence, empty cards, timeline)  
6. `ResponseOrchestrationExecutivePanel` — response slice (hidden when empty)  
7. `BiodiversityNationalSummaryCard` — biodiversity context  
8. `ExecutiveSummaryCard` — legacy demo brief  
9. `HallazgosList` or placeholder — demo hallazgos when no fire data  

## Data sources

| Block | API / source | Notes |
|-------|--------------|-------|
| DailyBriefHeaderBar | `useFireSummary` → fire APIs | Live ticker |
| CountryIndicatorsPanel | `COUNTRY_INDICATORS` demo + `buildFireThermalIndicator` | Mixed demo/live |
| ReasoningSequence | `buildFireReasoningSteps` or static | Cosmetic |
| FireHeatSummaryCard | Fire summary hooks | Domain-specific |
| NationalMetricsPanel | `/api/executive/metrics` | **Canonical** (Phase 1) |
| ExecutiveNationalCommandCenter | `/api/situacion/executive-dashboard` | 8C DTO |
| ResponseOrchestrationExecutivePanel | `/api/responses/executive-summary` | Conditional |
| BiodiversityNationalSummaryCard | Biodiversity hooks | Partial failure possible |
| ExecutiveSummaryCard | Fire brief or `DEMO_UI` | Legacy narrative |
| HallazgosList | `DEMO_UI.hallazgos` | Demo only |
| LiveTimelinePanel | `buildFireTimeline` or `DEMO_UI.timeline` | Pipeline steps |
| SourcesFooter | `DEMO_UI.sources` | **Static demo**, not live |

### Loading / error states

- Header: skeleton while fire loading  
- NationalMetricsPanel: skeleton grid / error message  
- ExecutiveNationalCommandCenter: single loading block; null if no data  
- Biodiversity: partial error supported in card  
- FireHeatSummaryCard: loading / error props  
- No unified stale-data badge at page level  
- Auth: `PermissionRoute` + `useAuthQueryReady` on metric hooks  

## Duplications identified

| Information | Appears in |
|-------------|------------|
| Fire observations / events | Header bar, FireHeatSummaryCard, NationalMetricsPanel, ExecutiveMetricGrid |
| Executive summary narrative | ExecutiveSummaryPanel (8C), ExecutiveSummaryCard (legacy) |
| Priority findings | ExecutiveNationalCommandCenter list, demo HallazgosList |
| System status / sources | DailyBriefHeaderBar, SystemStatusBar, SourcesFooter |
| Timeline | LiveTimelinePanel (pipeline), NationalTimeline (8C) |
| Empty sections | Multiple EmptyStateCard instances when counts = 0 |

## Above-the-fold vs scroll

**Above fold (1440px):** Header, title, country indicators sidebar start, reasoning sequence start.  
**Requires scroll:** Map, missions, evidence, biodiversity, legacy brief, hallazgos, most of 8C content.  
**Problem:** Map buried below ~6 sections; intelligence line consumes 25% width permanently.

## Block classification

| Block | Action | Rationale |
|-------|--------|-----------|
| DailyBriefHeaderBar | **merge** | Merge into operational header |
| CountryIndicatorsPanel (Salud Agrícola, Riesgo Climático, Hídrica) | **remove** / methodology_required | No frozen methodology — hide unofficial indices |
| Fire thermal from pipeline | **keep** | Derives from operational FIRMS pipeline |
| ReasoningSequence | **remove** | Cosmetic; not executive |
| FlyingQuetzal | **remove** | Decorative; wastes vertical space |
| FireHeatSummaryCard | **move_to_tab** | Actividad tab |
| NationalMetricsPanel (full grid) | **compact** | Max 6 primary KPIs in overview |
| ExecutiveMetricGrid (8C) | **merge** | Duplicate of canonical metrics |
| ExecutiveSummaryPanel | **compact** | 5-line deterministic summary in overview |
| ExecutiveSummaryCard (legacy) | **remove** | Superseded by deterministic builder |
| HallazgosList (demo) | **remove** | Replaced by TopFindings from dashboard |
| Priority findings list (8C) | **compact** | Top 3 in overview; full in Panorama tab |
| Incidents list (8C) | **compact** | Operational only in overview; legacy link |
| ExecutiveNationalMap | **keep** | Central in overview; refine legend/panel |
| Missions / evidence sections | **move_to_tab** | Operaciones / Verificación tabs |
| EmptyStateCard × N | **merge** | Single OperationalCycleStatus block |
| ResponseOrchestrationExecutivePanel | **move_to_tab** | Operaciones tab |
| BiodiversityNationalSummaryCard | **move_to_tab** | Panorama tab with partial error |
| LiveTimelinePanel | **move_to_drawer** | Collapsible intelligence line |
| NationalTimeline | **move_to_tab** | Timeline tab + drawer |
| SourcesFooter (fixed) | **move_to_drawer** | Sources button in header |
| SystemStatusBar | **merge** | Operational header |
| Demo toggle | **keep** | Visible banner; never silent mix |

## KPIs without visible methodology

| Index | Status |
|-------|--------|
| Salud Agrícola | **remove** — demo score, no frozen formula |
| Riesgo Climático | **remove** — demo score |
| Disponibilidad Hídrica | **remove** — demo score |
| Actividad térmica (FIRMS) | **keep** — registry + ExecutiveMetricsService |
| All registry metrics | **keep** — methodology via registry + “Ver metodología” |

## API call inventory (pre-Phase-3 initial load)

1. `/api/situacion/brief` (useDailyBrief — mostly unused)  
2. Fire summary + geo (multiple fire endpoints)  
3. `/api/executive/metrics` (NationalMetricsPanel)  
4. `/api/executive/data-quality-summary` (NationalMetricsPanel)  
5. `/api/situacion/executive-dashboard` (CommandCenter)  
6. Fire events + GeoJSON (map, again from CommandCenter)  
7. `/api/responses/executive-summary` (conditional)  
8. Biodiversity national summary  

**Duplication:** Executive metrics fetched in panel; dashboard has parallel metric keys; fire hooks called twice conceptually.

## Phase 3 target architecture

### Level 1 — Executive Overview (≈ one viewport)

- Operational header (territory, freshness, sources drawer, data quality)  
- 6 primary KPIs (ExecutiveMetricsService + pending decisions proxy)  
- 5-line executive summary (deterministic)  
- Executive map (central)  
- Top 3 priorities  
- Decision / action panel (compact)  
- Operational cycle status (single block when zeros)  
- Intelligence preview (last 3) + drawer  

### Level 2 — Tabs (lazy)

Panorama · Actividad · Verificación · Operaciones · Timeline

## Performance targets

- Single shared `useExecutiveMetrics` / `useExecutiveDashboard` via context  
- Lazy tab panels  
- Basic marks: time-to-KPIs, time-to-map, initial request count  

## Verification gate

`npm run national-situation:audit` — see `scripts/national-situation-audit.ts`.
