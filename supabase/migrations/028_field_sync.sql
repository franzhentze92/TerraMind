-- 028_field_sync.sql
-- TerraMind — Field Sync Engine (8B.7D)

create table if not exists public.evidence_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.evidence_submissions (id) on delete cascade,
  local_asset_id text,
  storage_path text not null,
  mime_type text not null,
  original_filename text not null default 'file',
  expected_size_bytes bigint not null,
  expected_checksum_sha256 text,
  bytes_transferred bigint not null default 0,
  status text not null check (status in (
    'pending', 'uploading', 'uploaded', 'confirmed', 'expired', 'failed'
  )),
  idempotency_key text,
  expires_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists evidence_upload_sessions_idempotency_idx
  on public.evidence_upload_sessions (submission_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists evidence_upload_sessions_submission_idx
  on public.evidence_upload_sessions (submission_id, status);

create table if not exists public.evidence_bundle_sync_registrations (
  id uuid primary key default gen_random_uuid(),
  bundle_id text not null,
  bundle_checksum text not null,
  mission_id uuid not null references public.missions (id) on delete cascade,
  package_id text,
  package_version integer,
  task_id text,
  status text not null check (status in (
    'registered', 'syncing', 'partially_synced', 'synced', 'conflict', 'rejected'
  )),
  idempotency_key text not null,
  remote_submission_ids jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists evidence_bundle_sync_registrations_idempotency_idx
  on public.evidence_bundle_sync_registrations (idempotency_key);

create unique index if not exists evidence_bundle_sync_registrations_bundle_idx
  on public.evidence_bundle_sync_registrations (bundle_id, bundle_checksum);

alter table public.evidence_upload_sessions enable row level security;
alter table public.evidence_bundle_sync_registrations enable row level security;
