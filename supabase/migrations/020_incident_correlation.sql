-- 020_incident_correlation.sql
-- TerraMind — Incident Correlation Core (8A.4)

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  incident_type text not null default 'possible_vegetation_fire_incident',
  domain text not null default 'fire',
  status text not null
    check (status in ('open', 'monitoring', 'resolved', 'invalidated', 'merged', 'split')),
  primary_event_type text,
  primary_event_id uuid,
  first_observed_at timestamptz not null,
  last_observed_at timestamptz not null,
  centroid_lat numeric,
  centroid_lng numeric,
  event_count integer not null default 0 check (event_count >= 0),
  active_event_count integer not null default 0 check (active_event_count >= 0),
  source_types jsonb not null default '[]'::jsonb,
  evidence_status text not null default 'single_source'
    check (evidence_status in (
      'single_source', 'multi_event_same_source', 'multi_source',
      'field_supported', 'verified'
    )),
  verification_status text not null default 'unverified',
  attention_score numeric(5, 2) not null default 0,
  verification_score numeric(5, 2) not null default 0,
  action_score numeric(5, 2) not null default 0,
  attention_level text not null default 'routine',
  verification_level text not null default 'not_required',
  action_level text not null default 'none',
  priority_explanation jsonb not null default '{}'::jsonb,
  priority_limitations jsonb not null default '[]'::jsonb,
  correlation_summary jsonb not null default '{}'::jsonb,
  priority_model_version text,
  correlation_model_version text not null,
  merged_into_incident_id uuid references public.incidents (id),
  split_from_incident_id uuid references public.incidents (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists incidents_status_idx
  on public.incidents (status, last_observed_at desc);

create index if not exists incidents_attention_idx
  on public.incidents (attention_score desc, last_observed_at desc);

create index if not exists incidents_primary_event_idx
  on public.incidents (primary_event_type, primary_event_id);

create table if not exists public.incident_event_memberships (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id),
  event_type text not null,
  event_id uuid not null,
  membership_status text not null
    check (membership_status in ('active', 'historical', 'removed', 'rejected')),
  membership_role text not null
    check (membership_role in ('primary', 'supporting', 'related', 'historical')),
  correlation_score numeric(5, 4) not null default 0,
  correlation_reasons jsonb not null default '[]'::jsonb,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  correlation_model_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists incident_event_memberships_active_unique_idx
  on public.incident_event_memberships (event_type, event_id)
  where membership_status = 'active';

create index if not exists incident_event_memberships_incident_idx
  on public.incident_event_memberships (incident_id, membership_status, joined_at desc);

create table if not exists public.incident_membership_history (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id),
  event_type text not null,
  event_id uuid not null,
  action text not null
    check (action in (
      'joined', 'left', 'role_changed', 'rejected', 'merged_in',
      'merged_out', 'split_out', 'split_in', 'primary_changed'
    )),
  previous_status text,
  new_status text,
  previous_role text,
  new_role text,
  correlation_score numeric(5, 4),
  correlation_reasons jsonb not null default '[]'::jsonb,
  evidence_snapshot jsonb not null default '{}'::jsonb,
  related_incident_id uuid references public.incidents (id),
  correlation_model_version text not null,
  created_at timestamptz not null default now()
);

create index if not exists incident_membership_history_incident_idx
  on public.incident_membership_history (incident_id, created_at desc);

create index if not exists incident_membership_history_event_idx
  on public.incident_membership_history (event_type, event_id, created_at desc);

create table if not exists public.incident_correlation_evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  event_id uuid not null,
  correlation_model_version text not null,
  context_signature text not null,
  correlation_decision text not null,
  correlation_score numeric(5, 4),
  spatial_score numeric(5, 4),
  temporal_score numeric(5, 4),
  semantic_score numeric(5, 4),
  source_diversity_score numeric(5, 4),
  lifecycle_compatibility numeric(5, 4),
  correlation_reasons jsonb not null default '[]'::jsonb,
  correlation_limitations jsonb not null default '[]'::jsonb,
  rejected_reasons jsonb not null default '[]'::jsonb,
  candidates_considered jsonb not null default '[]'::jsonb,
  incidents_considered jsonb not null default '[]'::jsonb,
  evidence_snapshot jsonb not null default '{}'::jsonb,
  incident_id uuid references public.incidents (id),
  membership_id uuid references public.incident_event_memberships (id),
  warnings jsonb not null default '[]'::jsonb,
  evaluated_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index if not exists incident_correlation_runs_signature_idx
  on public.incident_correlation_evaluation_runs (event_type, event_id, context_signature);

create index if not exists incident_correlation_runs_event_idx
  on public.incident_correlation_evaluation_runs (event_type, event_id, evaluated_at desc);

create table if not exists public.incident_correlation_jobs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null default 'fire_event',
  event_id uuid not null,
  requested_correlation_model_version text not null,
  requested_context_signature text,
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

create unique index if not exists incident_correlation_jobs_active_unique_idx
  on public.incident_correlation_jobs (event_type, event_id, requested_correlation_model_version)
  where status in ('pending', 'processing');

create index if not exists incident_correlation_jobs_status_available_idx
  on public.incident_correlation_jobs (status, available_at, priority desc);

create or replace function public.claim_incident_correlation_job(
  p_worker_id text,
  p_lock_timeout_minutes integer default 30
)
returns setof public.incident_correlation_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.incident_correlation_jobs;
begin
  update public.incident_correlation_jobs
  set
    status = 'pending',
    locked_at = null,
    locked_by = null,
    updated_at = now()
  where status = 'processing'
    and locked_at is not null
    and locked_at < now() - make_interval(mins => greatest(p_lock_timeout_minutes, 1));

  update public.incident_correlation_jobs j
  set
    status = 'processing',
    locked_at = now(),
    locked_by = p_worker_id,
    started_at = coalesce(j.started_at, now()),
    attempts = j.attempts + 1,
    updated_at = now()
  where j.id = (
    select id
    from public.incident_correlation_jobs
    where status = 'pending'
      and available_at <= now()
      and attempts < max_attempts
    order by priority desc, available_at asc, created_at asc
    limit 1
    for update skip locked
  )
  returning * into v_job;

  if v_job.id is not null then
    return next v_job;
  end if;
  return;
end;
$$;

alter table public.incidents enable row level security;
alter table public.incident_event_memberships enable row level security;
alter table public.incident_membership_history enable row level security;
alter table public.incident_correlation_evaluation_runs enable row level security;
alter table public.incident_correlation_jobs enable row level security;
