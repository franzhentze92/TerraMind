# Route Auth Inventory — 8B.7F.2

Machine-readable registry: `server/auth/route-registry.ts` (66 routes).

## Scope

Operational endpoints under:

- `/api/intelligence/*`
- `/api/environment/fires/*`
- `/api/operations/missions/*`
- `/api/operations/evidence-*`
- `/api/operations/offline-*`
- `/api/operations/field-sync/*`
- `/api/operations/tasks/*`
- `/api/operations/assignees/*`

## Protection model

Each protected route passes through `runOperationalGuard`:

1. Session (`rejectIfUnauthenticated`)
2. Rate limit (profile per route class)
3. Explicit permission (`assertPermission`)
4. Resource authorizer (`authorize*` from `server/services/authorization/`)
5. Optional audit event

List endpoints apply tenant scope via `filterRowsByActiveOrganization` before mapping DTOs.

Mutations validate payload IDs via `server/auth/payload-tenant-guard.ts`.

Service role requires `AuthorizedResourceContext` via `assertAuthorizedBeforeServiceRole`.

## Audit gate

```bash
npm run auth:audit
```

Fails on: stub auth, `system-operator`, bare login-only routes, incomplete registry entries, missing rate profiles, `FIELD_REAL_SYNC_ENABLED !== false`.

## Tests

```bash
npm run tenant-isolation:test
```

20 cross-tenant and negative authorization tests in `server/auth/`.

## Status

- **8B.7F foundation:** pushed as `7519afb` on `origin/main`
- **8B.7F.2:** endpoint authorization complete in working tree (not closed — 8B.7F.3 provisioning pending)
- **028/029:** not applied until staging confirmed
- **FIELD_REAL_SYNC_ENABLED:** `false`
