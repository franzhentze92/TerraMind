-- 024_evidence_intake.sql
-- TerraMind — Evidence Intake (8B.4)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mission-evidence',
  'mission-evidence',
  false,
  52428800,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'video/mp4', 'video/quicktime',
    'application/pdf', 'text/plain', 'application/json'
  ]
)
on conflict (id) do nothing;

create table if not exists public.evidence_submissions (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  mission_task_id uuid references public.mission_tasks (id) on delete set null,
  incident_id uuid not null references public.incidents (id),
  verification_plan_id uuid not null references public.verification_plans (id),
  verification_need_id uuid references public.verification_needs (id),
  submitted_by_type text not null check (submitted_by_type in ('user', 'system', 'institution', 'external_actor')),
  submitted_by_id text not null,
  source_type text not null check (source_type in (
    'mission_user', 'institution', 'citizen', 'sensor',
    'satellite_provider', 'system_generated', 'external_api'
  )),
  evidence_type text not null,
  status text not null check (status in (
    'received', 'processing', 'ready_for_validation', 'incomplete',
    'duplicate', 'unsupported', 'processing_failed', 'withdrawn'
  )),
  captured_at timestamptz,
  device_timestamp timestamptz,
  submitted_at timestamptz not null default now(),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  location_geometry jsonb,
  device_location_geometry jsonb,
  location_accuracy_m numeric,
  location_method text,
  location_discrepancy_m numeric,
  location_outside_mission_area boolean not null default false,
  source_device text,
  source_application text,
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  sensitivity_classification text not null default 'internal'
    check (sensitivity_classification in ('public', 'internal', 'restricted', 'sensitive_location')),
  intake_profile_version text not null default '1.0.0',
  context_signature text not null default '',
  supersedes_submission_id uuid references public.evidence_submissions (id),
  superseded_by_submission_id uuid references public.evidence_submissions (id),
  supersede_reason text,
  idempotency_key text,
  upload_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists evidence_submissions_idempotency_idx
  on public.evidence_submissions (mission_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists evidence_submissions_mission_idx
  on public.evidence_submissions (mission_id, status, submitted_at desc);

create index if not exists evidence_submissions_incident_idx
  on public.evidence_submissions (incident_id, submitted_at desc);

create index if not exists evidence_submissions_task_idx
  on public.evidence_submissions (mission_task_id)
  where mission_task_id is not null;

create table if not exists public.evidence_assets (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.evidence_submissions (id) on delete cascade,
  asset_type text not null check (asset_type in ('image', 'video', 'document', 'audio', 'other')),
  storage_provider text not null default 'supabase',
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  checksum_sha256 text,
  captured_at timestamptz,
  uploaded_at timestamptz,
  width integer,
  height integer,
  duration_seconds numeric,
  embedded_metadata jsonb not null default '{}'::jsonb,
  metadata_extraction_status text not null default 'pending'
    check (metadata_extraction_status in ('pending', 'extracted', 'incomplete', 'failed')),
  mime_extension_mismatch boolean not null default false,
  virus_scan_status text not null default 'skipped'
    check (virus_scan_status in ('pending', 'clean', 'infected', 'skipped')),
  upload_confirmed boolean not null default false,
  idempotency_key text,
  created_at timestamptz not null default now()
);

create unique index if not exists evidence_assets_storage_path_idx
  on public.evidence_assets (storage_path);

create unique index if not exists evidence_assets_checksum_mission_idx
  on public.evidence_assets (submission_id, checksum_sha256)
  where checksum_sha256 is not null and upload_confirmed = true;

create unique index if not exists evidence_assets_idempotency_idx
  on public.evidence_assets (submission_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists evidence_assets_checksum_idx
  on public.evidence_assets (checksum_sha256)
  where checksum_sha256 is not null;

create table if not exists public.evidence_observations (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.evidence_submissions (id) on delete cascade,
  observation_schema text not null,
  fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists evidence_observations_submission_idx
  on public.evidence_observations (submission_id);

create table if not exists public.evidence_requirement_links (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.evidence_submissions (id) on delete cascade,
  requirement_id uuid not null references public.mission_evidence_requirements (id) on delete cascade,
  match_type text not null check (match_type in (
    'potential_match', 'matched', 'partial_match', 'not_matched'
  )),
  match_score numeric not null default 0 check (match_score >= 0 and match_score <= 1),
  match_reason text not null default '',
  preliminary_coverage text not null default 'potential_match'
    check (preliminary_coverage in (
      'potential_match', 'matched', 'partial_match', 'not_matched', 'unlinked'
    )),
  created_at timestamptz not null default now()
);

create unique index if not exists evidence_requirement_links_unique_idx
  on public.evidence_requirement_links (submission_id, requirement_id);

create table if not exists public.evidence_intake_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.evidence_submissions (id) on delete cascade,
  event_type text not null,
  actor_type text not null check (actor_type in ('system', 'user')),
  actor_id text,
  payload jsonb not null default '{}'::jsonb,
  intake_profile_version text not null default '1.0.0',
  created_at timestamptz not null default now()
);

create index if not exists evidence_intake_events_submission_idx
  on public.evidence_intake_events (submission_id, created_at desc);

create table if not exists public.evidence_intake_evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null,
  action text not null,
  idempotency_key text,
  decision text not null,
  warnings jsonb not null default '[]'::jsonb,
  evaluated_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index if not exists evidence_intake_eval_idempotency_idx
  on public.evidence_intake_evaluation_runs (submission_id, action, idempotency_key)
  where idempotency_key is not null;

create table if not exists public.evidence_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.evidence_submissions (id) on delete cascade,
  status text not null check (status in ('pending', 'processing', 'completed', 'failed')),
  priority integer not null default 0,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  started_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists evidence_processing_jobs_submission_pending_idx
  on public.evidence_processing_jobs (submission_id)
  where status in ('pending', 'processing');

create or replace function public.claim_evidence_processing_job(
  p_worker_id text,
  p_lock_timeout_minutes integer default 30
)
returns setof public.evidence_processing_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.evidence_processing_jobs;
begin
  update public.evidence_processing_jobs
  set status = 'pending', locked_at = null, locked_by = null, updated_at = now()
  where status = 'processing'
    and locked_at is not null
    and locked_at < now() - make_interval(mins => greatest(p_lock_timeout_minutes, 1));

  update public.evidence_processing_jobs j
  set status = 'processing', locked_at = now(), locked_by = p_worker_id,
      started_at = coalesce(j.started_at, now()), attempts = j.attempts + 1, updated_at = now()
  where j.id = (
    select id from public.evidence_processing_jobs
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

alter table public.evidence_submissions enable row level security;
alter table public.evidence_assets enable row level security;
alter table public.evidence_observations enable row level security;
alter table public.evidence_requirement_links enable row level security;
alter table public.evidence_intake_events enable row level security;
alter table public.evidence_intake_evaluation_runs enable row level security;
alter table public.evidence_processing_jobs enable row level security;
