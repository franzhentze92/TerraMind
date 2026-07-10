-- 022_missions_core.sql
-- TerraMind — Missions Core (8B.2)

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  mission_type text not null,
  domain text not null,
  title text not null,
  objective text not null,
  status text not null
    check (status in (
      'draft', 'ready', 'approved', 'in_progress', 'blocked',
      'completed', 'inconclusive', 'cancelled', 'expired', 'failed'
    )),
  incident_id uuid not null references public.incidents (id),
  verification_plan_id uuid not null references public.verification_plans (id),
  primary_verification_need_id uuid references public.verification_needs (id),
  recommended_method_code text not null,
  location_geometry jsonb,
  location_description text not null default '',
  priority integer not null default 0 check (priority >= 0 and priority <= 100),
  earliest_start_at timestamptz not null,
  due_at timestamptz not null,
  expires_at timestamptz not null,
  completion_criteria jsonb not null default '{}'::jsonb,
  inconclusive_criteria jsonb not null default '{}'::jsonb,
  blocking_conditions jsonb not null default '[]'::jsonb,
  cancellation_conditions jsonb not null default '[]'::jsonb,
  mission_profile_version text not null,
  source_snapshot jsonb not null default '{}'::jsonb,
  context_signature text not null,
  superseded_by_mission_id uuid references public.missions (id),
  supersedes_mission_id uuid references public.missions (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz
);

create unique index if not exists missions_active_equivalent_unique_idx
  on public.missions (
    incident_id,
    verification_plan_id,
    primary_verification_need_id,
    recommended_method_code,
    mission_profile_version
  )
  where status in ('draft', 'ready', 'approved', 'in_progress', 'blocked');

create unique index if not exists missions_context_signature_idx
  on public.missions (verification_plan_id, context_signature);

create index if not exists missions_incident_idx
  on public.missions (incident_id, status, priority desc);

create index if not exists missions_plan_idx
  on public.missions (verification_plan_id, created_at desc);

create table if not exists public.mission_tasks (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  task_type text not null,
  sequence integer not null,
  title text not null,
  instructions text not null default '',
  status text not null
    check (status in ('pending', 'in_progress', 'completed', 'skipped', 'blocked', 'failed')),
  required boolean not null default true,
  completion_criteria jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists mission_tasks_sequence_idx
  on public.mission_tasks (mission_id, sequence);

create table if not exists public.mission_evidence_requirements (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  verification_need_id uuid references public.verification_needs (id),
  evidence_type text not null,
  required boolean not null default true,
  minimum_count integer not null default 1 check (minimum_count >= 0),
  required_metadata jsonb not null default '[]'::jsonb,
  quality_criteria jsonb not null default '[]'::jsonb,
  acceptance_criteria jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mission_evidence_requirements_mission_idx
  on public.mission_evidence_requirements (mission_id);

create table if not exists public.mission_status_transitions (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  from_status text not null,
  to_status text not null,
  reason text not null,
  actor_type text not null check (actor_type in ('system', 'user')),
  actor_id text,
  evidence_or_condition jsonb not null default '{}'::jsonb,
  mission_profile_version text not null,
  transitioned_at timestamptz not null default now()
);

create index if not exists mission_status_transitions_mission_idx
  on public.mission_status_transitions (mission_id, transitioned_at desc);

create table if not exists public.mission_creation_evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  verification_plan_id uuid not null,
  mission_profile_version text not null,
  context_signature text not null,
  mission_id uuid references public.missions (id),
  creation_decision text not null,
  warnings jsonb not null default '[]'::jsonb,
  evaluated_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index if not exists mission_creation_runs_signature_idx
  on public.mission_creation_evaluation_runs (verification_plan_id, context_signature);

create table if not exists public.mission_creation_jobs (
  id uuid primary key default gen_random_uuid(),
  verification_plan_id uuid not null,
  requested_mission_profile_version text not null,
  status text not null
    check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists mission_creation_jobs_active_unique_idx
  on public.mission_creation_jobs (verification_plan_id, requested_mission_profile_version)
  where status in ('pending', 'processing');

create index if not exists mission_creation_jobs_status_idx
  on public.mission_creation_jobs (status, available_at, priority desc);

alter table public.verification_plans
  add column if not exists linked_mission_id uuid references public.missions (id);

create or replace function public.claim_mission_creation_job(
  p_worker_id text,
  p_lock_timeout_minutes integer default 30
)
returns setof public.mission_creation_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.mission_creation_jobs;
begin
  update public.mission_creation_jobs
  set status = 'pending', locked_at = null, locked_by = null, updated_at = now()
  where status = 'processing'
    and locked_at is not null
    and locked_at < now() - make_interval(mins => greatest(p_lock_timeout_minutes, 1));

  update public.mission_creation_jobs j
  set status = 'processing', locked_at = now(), locked_by = p_worker_id,
      started_at = coalesce(j.started_at, now()), attempts = j.attempts + 1, updated_at = now()
  where j.id = (
    select id from public.mission_creation_jobs
    where status = 'pending' and available_at <= now() and attempts < max_attempts
    order by priority desc, available_at asc, created_at asc
    limit 1 for update skip locked
  )
  returning * into v_job;

  if v_job.id is not null then return next v_job; end if;
  return;
end;
$$;

alter table public.missions enable row level security;
alter table public.mission_tasks enable row level security;
alter table public.mission_evidence_requirements enable row level security;
alter table public.mission_status_transitions enable row level security;
alter table public.mission_creation_evaluation_runs enable row level security;
alter table public.mission_creation_jobs enable row level security;
