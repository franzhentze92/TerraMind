-- 027_offline_mission_packages.sql
-- TerraMind — Offline Mission Package (8B.7A)

create table if not exists public.offline_mission_packages (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  assignment_id uuid references public.mission_assignments (id) on delete set null,
  status text not null check (status in (
    'queued', 'generating', 'ready', 'downloaded', 'superseded',
    'revoked', 'expired', 'generation_failed'
  )),
  package_version integer not null default 1 check (package_version > 0),
  offline_package_model_version text not null default '1.0.0',
  manifest jsonb not null default '{}'::jsonb,
  manifest_checksum text not null default '',
  signature text not null default '',
  storage_path text,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  generated_at timestamptz,
  generated_by text,
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  download_expires_at timestamptz,
  revoked_at timestamptz,
  revocation_reason text,
  supersedes_package_id uuid references public.offline_mission_packages (id),
  context_signature text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists offline_mission_packages_active_signature_idx
  on public.offline_mission_packages (mission_id, context_signature, offline_package_model_version)
  where status in ('queued', 'generating', 'ready', 'downloaded');

create index if not exists offline_mission_packages_mission_idx
  on public.offline_mission_packages (mission_id, package_version desc, created_at desc);

create table if not exists public.offline_package_files (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.offline_mission_packages (id) on delete cascade,
  path text not null,
  mime_type text not null,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  sha256 text not null,
  content jsonb,
  content_text text,
  created_at timestamptz not null default now()
);

create unique index if not exists offline_package_files_path_idx
  on public.offline_package_files (package_id, path);

create table if not exists public.offline_package_generation_runs (
  id uuid primary key default gen_random_uuid(),
  package_id uuid references public.offline_mission_packages (id) on delete set null,
  mission_id uuid not null references public.missions (id) on delete cascade,
  offline_package_model_version text not null default '1.0.0',
  context_signature text not null,
  idempotency_key text,
  decision text not null,
  warnings jsonb not null default '[]'::jsonb,
  redaction_summary jsonb not null default '{}'::jsonb,
  evaluated_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index if not exists offline_package_generation_runs_idempotency_idx
  on public.offline_package_generation_runs (mission_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists offline_package_generation_runs_context_idx
  on public.offline_package_generation_runs (mission_id, context_signature, offline_package_model_version);

create table if not exists public.offline_package_events (
  id uuid primary key default gen_random_uuid(),
  package_id uuid references public.offline_mission_packages (id) on delete set null,
  mission_id uuid not null references public.missions (id) on delete cascade,
  assignment_id uuid references public.mission_assignments (id) on delete set null,
  event_type text not null,
  actor_type text not null check (actor_type in ('system', 'user')),
  actor_id text,
  payload jsonb not null default '{}'::jsonb,
  offline_package_model_version text not null default '1.0.0',
  created_at timestamptz not null default now()
);

create index if not exists offline_package_events_package_idx
  on public.offline_package_events (package_id, created_at desc);

create table if not exists public.offline_package_jobs (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  assignment_id uuid references public.mission_assignments (id) on delete set null,
  offline_package_model_version text not null default '1.0.0',
  context_signature text not null default '',
  status text not null check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  priority integer not null default 0,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  started_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  last_error_message text,
  idempotency_key text,
  requested_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists offline_package_jobs_active_signature_idx
  on public.offline_package_jobs (mission_id, context_signature, offline_package_model_version)
  where status in ('pending', 'processing');

create unique index if not exists offline_package_jobs_idempotency_idx
  on public.offline_package_jobs (mission_id, idempotency_key)
  where idempotency_key is not null and status in ('pending', 'processing');

create index if not exists offline_package_jobs_status_idx
  on public.offline_package_jobs (status, available_at, priority desc);

create table if not exists public.offline_package_downloads (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.offline_mission_packages (id) on delete cascade,
  user_id text,
  team_id text,
  device_pseudonym text,
  download_started_at timestamptz not null default now(),
  download_completed_at timestamptz,
  checksum_verified boolean,
  ip_metadata jsonb not null default '{}'::jsonb,
  app_version text,
  idempotency_key text,
  created_at timestamptz not null default now()
);

create unique index if not exists offline_package_downloads_idempotency_idx
  on public.offline_package_downloads (package_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.claim_offline_package_job(
  p_worker_id text,
  p_lock_timeout_minutes integer default 30
)
returns setof public.offline_package_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.offline_package_jobs;
begin
  update public.offline_package_jobs
  set status = 'pending', locked_at = null, locked_by = null, updated_at = now()
  where status = 'processing'
    and locked_at is not null
    and locked_at < now() - make_interval(mins => greatest(p_lock_timeout_minutes, 1));

  update public.offline_package_jobs j
  set status = 'processing', locked_at = now(), locked_by = p_worker_id,
      started_at = coalesce(j.started_at, now()), attempts = j.attempts + 1, updated_at = now()
  where j.id = (
    select id from public.offline_package_jobs
    where status = 'pending' and available_at <= now() and attempts < max_attempts
    order by priority desc, available_at asc, created_at asc
    limit 1 for update skip locked
  )
  returning * into v_job;

  if v_job.id is not null then
    return next v_job;
  end if;
end;
$$;

alter table public.offline_mission_packages enable row level security;
alter table public.offline_package_files enable row level security;
alter table public.offline_package_generation_runs enable row level security;
alter table public.offline_package_events enable row level security;
alter table public.offline_package_jobs enable row level security;
alter table public.offline_package_downloads enable row level security;
