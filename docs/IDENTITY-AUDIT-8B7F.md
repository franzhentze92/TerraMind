# 8B.7F — Identity & Authorization Audit (pre-implementation)

Date: 2026-07-10

## Executive summary

TerraMind had **no real user authentication** before 8B.7F. The API exposed operational endpoints behind a `requireAuth` stub that always returned `true`, while all database access used the Supabase **service role**. Domain permission engines existed (missions, evidence, field sync) but received permissions from request bodies or defaulted to full access via `system-operator`.

8B.7F replaces the stub with Supabase Auth JWT validation, tenant-scoped authorization, and audited service-role access.

## Login system (before 8B.7F)

| Item | Finding |
|------|---------|
| Login UI | **None** — no `/login` route or auth pages |
| Auth provider | **Supabase Auth** (intended) — `@supabase/supabase-js` on server only |
| Supabase Auth client (browser) | **Not wired** — no `VITE_SUPABASE_*` in `.env.example` |
| Session persistence | **None** on frontend |
| Token to backend | `credentials: 'include'` in some API modules but **no cookies set** |
| Recovery / signup | **Not implemented** |

## Backend auth (before 8B.7F)

| File | Role |
|------|------|
| `server/middleware/auth.ts` | Stub — `requireAuth()` always `true` |
| All `server/routes/*.ts` | Call `rejectIfUnauthenticated` (no-op) |
| Inline routes in `server/index.ts` | `/api/health`, `/api/pipeline/*` — **no auth** (health remains public) |

## Database identity tables (before 8B.7F)

| Table | Status |
|-------|--------|
| `organizations` | **Missing** |
| `user_profiles` | **Missing** |
| `organization_memberships` | **Missing** |
| `roles` / `permissions` / `role_permissions` | **Missing** |
| `operational_teams` / `operational_assignees` | Exist — `organization_id text` without FK |
| `team_memberships` | Team↔assignee, not user↔org |

## Operational `organization_id` (before 8B.7F)

Present as free-text on assignment tables only. **Not** on: `incidents`, `verification_plans`, `missions`, `evidence_submissions`, `offline_mission_packages`, sync tables (028).

## Service role usage

Single entry: `src/pipeline/stores/supabase.client.ts` → `getSupabaseAdmin()`.

Used by all pipeline stores and server services (~50+ files). RLS enabled on many tables but **no user-scoped policies**; service role bypasses RLS entirely.

## Fake / default identities (before 8B.7F)

| ID | Location | Risk |
|----|----------|------|
| `system-operator` | `mission-workflow.service.ts`, `evidence-intake.service.ts` | Default actor with ALL permissions |
| Client `actor_id` in JSON body | missions, evidence, offline-packages, field-sync routes | Spoofable |
| `authStub` | `src/core/auth/types.ts` | Unused placeholder |

## Frontend protection (before 8B.7F)

- No `ProtectedRoute`, `AuthProvider`, or permission-gated UI
- `src/core/permissions/index.ts` — UI roles never enforced
- All routes public under `AppShell`

## Routes using stub (all operational)

`fires`, `climate`, `biodiversity`, `findings`, `priorities`, `lifecycle`, `incidents`, `verification`, `missions`, `evidence-intake`, `evidence-validation`, `verification-resolution`, `offline-packages`, `field-sync`.

## 8B.7F changes (this commit)

- Migration `029_auth_tenant_isolation.sql` (additive, **not applied** to remote until staging confirmed)
- Real JWT middleware + `RequestAuthContext`
- Permission catalog + role mappings
- Centralized `authorize*` services
- `AuthorizedResourceContext` required before service-role DB writes on operational paths
- Frontend: Supabase Auth login, session, protected routes, org selector
- IndexedDB partition keys: `organization_id` + `user_id`
- `npm run auth:audit` + `npm run tenant-isolation:test`
- `FIELD_REAL_SYNC_ENABLED` remains `false`

## Reuse (no parallel identity system)

- Supabase Auth for tokens (existing dependency)
- Domain permission strings from missions/evidence modules
- `operational_assignees` linked to `user_profiles.id` via migration column
- Extend `src/core/auth/types.ts` rather than duplicate
