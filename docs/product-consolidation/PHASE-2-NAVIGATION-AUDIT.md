# Product Consolidation — Phase 2: Navigation & Role-Based Experience

Machine-readable registry: [`src/shared/navigation/navigation-registry.ts`](../../src/shared/navigation/navigation-registry.ts)  
Role visibility: [`src/shared/navigation/role-navigation.ts`](../../src/shared/navigation/role-navigation.ts)  
Audit gate: `npm run product-navigation:audit`

## 1. Initial audit summary (before Phase 2)

| Issue | Before |
|---|---|
| Sidebar sections | 6 fragmented sections including "Centro Nacional" and "Conocimiento" |
| Campo | 3 separate sidebar entries (PWA, Paquetes, Evidencia pendiente) |
| Asignaciones | Top-level sidebar item duplicating Misiones |
| Permission gating | Only `responses.view` and `organization.settings` in sidebar; most routes unguarded |
| Breadcrumbs | None — only ad-hoc back links in Campo |
| Incident titles | `"Situación operacional · N evento(s)"` or truncated UUIDs |
| Campo copy | `fixture`, `allowlist`, `8B.7G`, `Sync simulado`, English fragments |
| Empty states | Plain `"Sin registros"` without explanation or CTA |

Full route inventory is encoded in `ROUTE_REGISTRY` (40+ paths including aliases and Campo sub-routes).

## 2. New navigation architecture

| Section | Primary items |
|---|---|
| **Monitoreo** | Situación Nacional, Actividad térmica, Biodiversidad, Territorio |
| **Inteligencia** | Hallazgos, Prioridades, Incidentes |
| **Operaciones** | Verificaciones, Misiones, Respuesta |
| **Campo** | Mi trabajo (`/campo`) |
| **Análisis** | Tendencias, Informes, Copilot |
| **Administración** | Organización, Integraciones, Sistema |

Campo secondary nav (inside layout): Inicio · Misiones · Paquetes · Evidencia · Sincronización · Conflictos

## 3. Changes delivered

- **Campo consolidated** — single sidebar entry; sub-routes preserved (`/campo/paquetes`, etc.)
- **Asignaciones inside Misiones** — tabs on `/misiones` + `/misiones/asignaciones`; alias `/operaciones/asignaciones` → redirect
- **Role-based sidebar** — viewer / analyst / field technician / org admin visibility via `role-navigation.ts`
- **Route guards** — `PermissionRoute` on operational routes via `guard()` in `router.tsx`
- **Breadcrumbs + PageHeader** — incident list/detail, missions, assignments, response list
- **Incident display names** — `incident-display-name.ts` (deterministic, non-alarmist)
- **Product language extended** — Phase 2 tokens + `FORBIDDEN_UI_TERMS` for audit
- **Campo dev language removed** from visible UI surfaces
- **OperationalEmptyState** — missions, assignments, response list
- **Collapsible sidebar** — desktop collapse persisted in `localStorage`

## 4. Aliases preserved

| Legacy path | Resolution |
|---|---|
| `/situacion-nacional` | Same component as `/situacion` |
| `/operaciones/asignaciones` | Redirect → `/misiones/asignaciones` |
| `/events`, `/reports`, `/trends`, etc. | Existing redirects unchanged |
| All `/campo/*` paths | Unchanged |

## 5. Tests & audit

- `src/shared/navigation/navigation.test.ts` — registry, role visibility, aliases, route protection
- `src/modules/incidents/utils/incident-display-name.test.ts` — naming rules, no UUIDs in breadcrumbs
- `npm run product-navigation:audit` — sidebar/registry consistency, forbidden terms, empty states

## 6. Out of scope (Phase 2)

No Situación Nacional redesign, no new KPIs, no new engines, no full mobile responsive redesign, no 8C.2.
