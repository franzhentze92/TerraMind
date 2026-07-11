# 8B.7G — Controlled Real Field Sync Pilot Report

**Base commit (pre-8B.7G):** `380c964`  
**Project:** `djtk…neul` (masked)  
**Date:** 2026-07-10  
**Global flag:** `FIELD_REAL_SYNC_ENABLED = false` (unchanged)

## Pilot scope

| Item | Value |
|------|--------|
| Organization | TerraMind Platform (`3d641b07…fa69`) |
| User | platform admin (auth prefix `c39903cd…71ffb`) |
| Mission | `Field Sync Pilot — Internal Verification` (`7151e1bd…31d7d`) |
| Label | `internal_pilot` — not an environmental emergency |

## Allowlist policy

Server-side `RealSyncPilotPolicy` requires **all** of:

- `FIELD_REAL_SYNC_PILOT_ENABLED=true`
- organization allowlisted
- user allowlisted
- mission allowlisted
- permission `field_sync.execute`
- valid assignment + package + tenant

Global sync remains **disabled**.

## Execution summary

| Step | Result |
|------|--------|
| Pilot mission created | ✓ |
| Assignment to internal admin | ✓ |
| Offline package generation requested | ✓ |
| Bundle registration (real sync) | ✓ 1 registration → `synced` |
| Evidence submission created | ✓ 1 (`georeferenced_photo`) |
| Resumable upload + asset confirm | ✓ 1 asset (287 B JPEG) |
| Location attached | ✓ (generic internal test coordinate) |
| Structured observation | ✓ |
| Requirement links | ✓ 2 |
| Finalize / processing | ✓ `ready_for_validation` |
| Idempotent bundle re-register | ✓ replay, no duplicate |
| Idempotent submission replay | ✓ |
| Validation job enqueued | ✓ 1 |
| Non-allowlisted access | Blocked server-side (403 policy) |

## Remote identifiers (masked)

| Artifact | ID prefix |
|----------|-----------|
| Submission | `7a4b4fef…` |
| Asset | `4ebda900…` (checksum `ef0ae0d6…30c8a`) |
| Bundle | `pilot-bundle-7151e1bd` |
| Bundle registration | `4299a581…` |

## Counts (remote, post-verify)

| Table | Pilot mission |
|-------|----------------|
| evidence_submissions | 1 |
| evidence_assets | 1 |
| evidence_bundle_sync_registrations | 1 (`synced`) |
| evidence_validation_jobs | 1 |
| failed upload sessions removed | 0 |

## Interruption / resume

- First run stopped after upload confirm (before finalize)
- Resume path skipped re-upload (asset already present)
- Added location + observation + finalize on resume
- Demonstrates resumable sync without duplicate assets

## Idempotency

- Second `registerBundleSync` with same idempotency key: **replay**
- Second `createEvidenceSubmission`: **replay**
- Second `finalizeSubmissionIntake`: no duplicate submission or assets

## Security

- No secrets, passwords, signed URLs, or field coordinates in this report
- Allowlist env vars **not** committed to Git
- Pilot CLI requires `--confirm-project`
- `AUTH_TEST_MODE` bypasses pilot gate only in unit tests

## UI

- `/campo` shows **Piloto interno** banner when pilot active for allowlisted mission
- Sync uses HTTP transport when `useRealSyncPilot` allows mission

## Residual / cleanup

**Conserved:** pilot mission, submission, asset, audit trail, validation job  
**Cleanup:** 0 failed upload sessions removed  
**Manual action:** clear `FIELD_REAL_SYNC_PILOT_*` from local `.env` after review

## Issues found

1. Partial first run left submission in `processing` — resume path added to CLI
2. `georeferenced_photo` requires location metadata before `ready_for_validation`
3. Requirement link `match_type` must use schema enum values
4. Storage upload retry on same path returns conflict — idempotent confirm handles replays

## Corrective actions

- Idempotent/resumable `field-sync-pilot.ts --mode=run`
- Policy unit tests + auth test isolation from shell pilot env
- Documented env vars in `.env.example`

## Feature flag / allowlist final state

| Setting | Value |
|---------|--------|
| `FIELD_REAL_SYNC_ENABLED` | `false` (global, unchanged) |
| `FIELD_REAL_SYNC_PILOT_ENABLED` | `true` during pilot only — **clear after review** |
| Allowlist | TerraMind org + admin user + pilot mission only |

## Status

**8B.7G CLOSED** — first authorized real field sync completed end-to-end with allowlist enforcement.

- Single submission at `ready_for_validation`
- Assets and observations match reconciliation
- Upload resumed without duplicates
- Idempotency demonstrated
- Validation job enqueued once
- Sync blocked outside allowlist

**Not enabled:** global real sync.

## Next step

**8B.7H — Internal Field Sync Rollout** — expand allowlist to a small internal group with monitoring, limits, alerts, and rollback.
