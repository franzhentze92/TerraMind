# 8B.7F.4 — Database Activation & Real Auth Smoke Test

Operational activation for Supabase migrations **028 → 029 → 030**, platform bootstrap, and real auth smoke tests.

## Safety rules

- Never commit `.env` or secrets.
- The activation script **does not execute DDL** — apply migrations via Supabase migrations tooling only.
- Remote modes require `--confirm-project=<project-ref>` matching `SUPABASE_URL`.
- The script **never logs** tokens, passwords, or bootstrap secrets.
- **Never suspend the platform administrator** — membership tests use a temporary member only.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only service role |
| `SUPABASE_ANON_KEY` | Smoke login / JWT validation |
| `AUTH_TEST_EMAIL` | Existing Supabase Auth user for smoke tests |
| `AUTH_TEST_PASSWORD` | Password for smoke login (never stored by script) |
| `AUTH_BOOTSTRAP_TOKEN` | One-shot bootstrap (remove after first run) |
| `AUTH_BOOTSTRAP_AUTH_USER_ID` | Auth user UUID allowed to bootstrap |
| `TERRAMIND_PORT` | API server port (default `3001`) |

## Commands

```bash
# Local preflight (migration files, additive SQL scan)
npm run auth:activation-8b7f4 -- --mode=preflight

# Verify remote migrations applied (read-only)
npm run auth:activation-8b7f4 -- --mode=apply --confirm-project=YOUR_PROJECT_REF

# One-shot bootstrap (mutates remote — run once)
npm run auth:activation-8b7f4 -- --mode=bootstrap --confirm-project=YOUR_PROJECT_REF

# Real auth/API smoke (requires running API server)
npm run auth:activation-8b7f4 -- --mode=smoke --confirm-project=YOUR_PROJECT_REF

# Write remote status artifact (no secrets)
npm run auth:activation-8b7f4 -- --mode=report --confirm-project=YOUR_PROJECT_REF
```

## Remote verification artifact

`--mode=report` writes `docs/reports/8B7F4-remote-status.json` with masked project ref, migration names, and table counts only.

## Post-activation status

- **8B.7F** — operationally closed
- **8B.7D database infrastructure** — activated
- **`FIELD_REAL_SYNC_ENABLED`** — remains `false` until 8B.7G pilot

## Next step

**8B.7G — Controlled Real Field Sync Pilot** (mission real, allowlist-only sync flag).
