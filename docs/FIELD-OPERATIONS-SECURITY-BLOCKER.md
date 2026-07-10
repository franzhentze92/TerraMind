# Field Operations — Security Blocker (8B.7F required)

## Current status

| Milestone | Status |
|-----------|--------|
| 8B.7D code | Complete and pushed |
| 8B.7D infrastructure | **Activation pending** — migration `028_field_sync.sql` not applied |
| 8B.7E mobile experience | **Mocks + IndexedDB only** |
| Production sync | **Blocked** by security and environment validation |

## Why real sync is blocked

1. **`requireAuth` is still a stub** — requests are not tied to authenticated users with verified permissions.
2. **Backend uses Supabase service role** — Row Level Security does not protect service-role operations.
3. **Sync tables lack `organization_id`** — tenant isolation cannot be enforced at the database layer alone.
4. **No explicit organization validation per operation** — mission/package/submission ownership is not checked on every endpoint.
5. **No confirmed staging environment** — migration 028 must not be applied to an unverified production project.

## What 8B.7E does (safe)

- Mobile PWA at `/campo/*` with offline package → forms → evidence → **simulated** sync.
- `FIELD_REAL_SYNC_ENABLED = false` in field-mobile config.
- HTTP sync transport replaced by mock transport in field UI hooks when real sync is disabled.
- No Supabase writes, no service-role keys in client code, no production E2E.

## Mandatory next step: 8B.7F — Field Sync Authorization & Tenant Isolation

**Status:** In progress in commit `8B.7F` — stub removed, JWT middleware, migration 029 ready (not applied).

Before applying migration 028 or enabling operational sync in production:

- Replace `requireAuth` stub with real authentication.
- Authorize by permission; derive tenant server-side.
- Validate mission and submission access per request.
- Reject cross-organization IDs.
- Encapsulate service role behind audited server checks.
- Add negative multi-tenant tests and rate limits.
- Validate ownership on **every** sync endpoint.

## Do not

- Apply `028_field_sync.sql` until staging project ref is confirmed.
- Set `FIELD_REAL_SYNC_ENABLED = true` before 8B.7F closes.
- Deploy field-sync routes as production-operational without tenant isolation.
