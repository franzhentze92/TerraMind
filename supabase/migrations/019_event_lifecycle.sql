-- 019_event_lifecycle.sql
-- TerraMind — Intelligence Event Lifecycle (8A.3)
-- Rollback:
--   DROP FUNCTION IF EXISTS claim_event_lifecycle_job;
--   DROP TABLE IF EXISTS event_lifecycle_evaluation_runs;
--   DROP TABLE IF EXISTS event_lifecycle_jobs;
--   DROP TABLE IF EXISTS event_lifecycle_transitions;
--   ALTER TABLE fire_events DROP COLUMN IF EXISTS lifecycle_state, ...

alter table public.fire_events
  add column if not exists lifecycle_state text
    check (lifecycle_state in (
      'detected', 'active', 'persistent', 'expanding', 'declining',
      'inactive_monitoring', 'resolved', 'reactivated', 'invalidated'
    )),
  add column if not exists lifecycle_model_version text,
  add column if not exists state_changed_at timestamptz,
  add column if not exists inactive_since timestamptz,
  add column if not exists monitoring_until timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists reactivated_at timestamptz,
  add column if not exists last_confirmed_at timestamptz;

create index if not exists fire_events_lifecycle_state_idx
  on public.fire_events (lifecycle_state, last_detected_at desc);

create table if not exists public.event_lifecycle_transitions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null default 'fire_event',
  entity_id uuid not null,
  previous_state text,
  new_state text not null,
  transitioned boolean not null default false,
  transition_reason text not null default '',
  transition_rule text,
  evidence_snapshot jsonb not null default '{}'::jsonb,
  source_detection_ids jsonb not null default '[]'::jsonb,
  lifecycle_model_version text not null,
  context_signature text not null,
  previous_transition_id uuid references public.event_lifecycle_transitions (id),
  evaluated_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index if not exists event_lifecycle_transitions_signature_idx
  on public.event_lifecycle_transitions (entity_type, entity_id, context_signature);

create index if not exists event_lifecycle_transitions_entity_idx
  on public.event_lifecycle_transitions (entity_type, entity_id, evaluated_at desc);

create table if not exists public.event_lifecycle_evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  lifecycle_model_version text not null,
  context_signature text not null,
  previous_state text,
  new_state text not null,
  transitioned boolean not null default false,
  transition_id uuid references public.event_lifecycle_transitions (id),
  findings_jobs_enqueued integer not null default 0,
  priority_jobs_enqueued integer not null default 0,
  findings_synced integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists event_lifecycle_evaluation_runs_entity_idx
  on public.event_lifecycle_evaluation_runs (entity_type, entity_id, completed_at desc);

create table if not exists public.event_lifecycle_jobs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null default 'fire_event',
  entity_id uuid not null,
  requested_lifecycle_model_version text not null,
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

create unique index if not exists event_lifecycle_jobs_active_unique_idx
  on public.event_lifecycle_jobs (entity_type, entity_id, requested_lifecycle_model_version)
  where status in ('pending', 'processing');

create index if not exists event_lifecycle_jobs_status_available_idx
  on public.event_lifecycle_jobs (status, available_at, priority desc);

create or replace function public.claim_event_lifecycle_job(
  p_worker_id text,
  p_lock_timeout_minutes integer default 30
)
returns setof public.event_lifecycle_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.event_lifecycle_jobs;
begin
  update public.event_lifecycle_jobs
  set
    status = 'pending',
    locked_at = null,
    locked_by = null,
    updated_at = now()
  where status = 'processing'
    and locked_at is not null
    and locked_at < now() - make_interval(mins => greatest(p_lock_timeout_minutes, 1));

  update public.event_lifecycle_jobs j
  set
    status = 'processing',
    locked_at = now(),
    locked_by = p_worker_id,
    started_at = coalesce(j.started_at, now()),
    attempts = j.attempts + 1,
    updated_at = now()
  where j.id = (
    select id
    from public.event_lifecycle_jobs
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

-- Bootstrap lifecycle_state from legacy status for existing rows
update public.fire_events
set
  lifecycle_state = case status
    when 'new' then 'detected'
    when 'active' then 'active'
    when 'monitoring' then 'inactive_monitoring'
    when 'closed' then 'resolved'
    else 'detected'
  end,
  lifecycle_model_version = coalesce(lifecycle_model_version, '1.0.0'),
  state_changed_at = coalesce(state_changed_at, updated_at, created_at)
where lifecycle_state is null;

alter table public.event_lifecycle_transitions enable row level security;
alter table public.event_lifecycle_evaluation_runs enable row level security;
alter table public.event_lifecycle_jobs enable row level security;
