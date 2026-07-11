# Phase 4 — Intelligence-to-Action Flow Audit

Base: Phase 3 complete (`40d7815`).

## Objective

Connect the intelligence chain in UI without new domain engines:

Hallazgo → Prioridad → Incidente → Verificación → Misión → Evidencia → Resolución → Respuesta → Informe

## Module audit summary

| Module | List | Detail | Flow navigator | Breadcrumbs | Relations |
|--------|------|--------|----------------|-------------|-----------|
| Hallazgos | FindingsPage | FindingDetailPage | ✓ | ✓ | via `/api/intelligence-flow/finding/:id` |
| Prioridades | PrioritiesPage | PriorityDetailPage | ✓ | ✓ | flow + finding links |
| Incidentes | IncidentsPage | IncidentDetailPage | ✓ | ✓ | hub + anchors #verificacion #resolucion |
| Verificaciones | VerificationsPage | embedded in incident | partial | list→incident | no standalone plan route |
| Misiones | MissionsPage | MissionDetailPage | ✓ | ✓ | incident + evidence section |
| Evidencia | mission embed | EvidenceSubmissionDetailPanel | partial | N/A | via mission flow |
| Resolución | incident embed | IncidentVerificationResolutionSection | partial | anchor | empty when 0 |
| Respuesta | ResponseOrchestrationListPage | ResponseOrchestrationDetailPage | ✓ | ✓ | incident display name |
| Informes | ReportsHubPage | IncidentReportPage | ✓ | ✓ | story + PDF |

## Link classification (pre-Phase 4 → post-Phase 4)

| Link | Before | After |
|------|--------|-------|
| Finding → Priority | missing | connected (flow API) |
| Finding → Incident | missing | connected |
| Priority → Findings | partially_connected | connected (links in snapshot) |
| Priority → Incident | missing | connected |
| Incident → Verification | connected | connected + anchor |
| Incident → Mission | connected | connected |
| Mission → Evidence | partially_connected | connected (#evidencia) |
| Incident → Response | connected | connected |
| Response → Report | missing | connected (flow CTA) |
| UUID titles | partially_connected | removed on response/report |

## API

**New:** `GET /api/intelligence-flow/:resourceType/:resourceId`

Types: `finding`, `priority`, `incident`, `mission`, `evidence`, `response`

Adapter: `server/services/intelligence-flow.service.ts` — reads existing stores only.

## UI components

- `IntelligenceFlowNavigator` — cycle visualization (not a wizard)
- `IntelligenceFlowActionsPanel` — permission-aware CTAs
- `IntelligenceFlowSections` — shared hook + navigator + actions
- `PriorityScoreExplanation` — three-score breakdown
- `buildIntelligenceFlowActions` — centralized CTA logic

## Legacy / demo

- Flow nodes mark `legacy` / `demo` status
- Legacy incidents: badge + blockingReason on tenant-owned actions
- Demo missions/incidents: visible only when included; not counted operational

## Gaps remaining (by design / Phase 5+)

- Standalone `/verificaciones/:planId` detail page
- Standalone evidence submission route
- Deep mobile responsive
- Global TypeScript build (Phase 7)
- Field Operations expansion

## Performance

- Single flow request per detail page via React Query cache (`staleTime: 30s`)
- Tab/detail lazy loading unchanged
- No duplicate fan-out from page components
