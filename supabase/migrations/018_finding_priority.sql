-- 018_finding_priority.sql
-- TerraMind — Motor de prioridad de hallazgos (8A.2)
-- Rollback:
--   DROP FUNCTION IF EXISTS claim_finding_priority_job;
--   DROP TABLE IF EXISTS finding_priority_evaluation_runs;
--   DROP TABLE IF EXISTS finding_priority_jobs;
--   DROP TABLE IF EXISTS finding_priority_assessments;

create table if not exists public.finding_priority_assessments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  assessment_status text not null
    check (assessment_status in ('active', 'superseded', 'expired')),
  attention_score numeric(5, 2) not null check (attention_score >= 0 and attention_score <= 100),
  action_score numeric(5, 2) not null check (action_score >= 0 and action_score <= 100),
  verification_score numeric(5, 2) not null check (verification_score >= 0 and verification_score <= 100),
  attention_level text not null
    check (attention_level in ('routine', 'monitor', 'review', 'high_attention', 'priority_attention')),
  action_level text not null
    check (action_level in ('none', 'prepare', 'coordinate', 'operational_attention')),
  verification_level text not null
    check (verification_level in ('not_required', 'useful', 'recommended', 'high_priority')),
  severity_component numeric(5, 2) not null default 0,
  urgency_component numeric(5, 2) not null default 0,
  exposure_component numeric(5, 2) not null default 0,
  sensitivity_component numeric(5, 2) not null default 0,
  confidence_component numeric(5, 2) not null default 0,
  persistence_component numeric(5, 2) not null default 0,
  domain_contributions jsonb not null default '{}'::jsonb,
  score_explanation jsonb not null default '{}'::jsonb,
  priority_reasons jsonb not null default '[]'::jsonb,
  priority_limitations jsonb not null default '[]'::jsonb,
  recommended_next_step text not null default '',
  finding_snapshot jsonb not null default '[]'::jsonb,
  context_version text not null,
  rule_set_version text not null,
  priority_model_version text not null,
  previous_assessment_id uuid references public.finding_priority_assessments (id),
  score_delta jsonb not null default '{}'::jsonb,
  level_change jsonb not null default '{}'::jsonb,
  change_reasons jsonb not null default '[]'::jsonb,
  evaluated_at timestamptz not null,
  valid_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists finding_priority_assessments_active_unique_idx
  on public.finding_priority_assessments (entity_type, entity_id, priority_model_version)
  where assessment_status = 'active';

create index if not exists finding_priority_assessments_entity_idx
  on public.finding_priority_assessments (entity_type, entity_id, evaluated_at desc);

create index if not exists finding_priority_assessments_attention_idx
  on public.finding_priority_assessments (assessment_status, attention_score desc, evaluated_at desc);

create index if not exists finding_priority_assessments_attention_level_idx
  on public.finding_priority_assessments (attention_level, evaluated_at desc);

create table if not exists public.finding_priority_evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  priority_model_version text not null,
  context_version text not null,
  rule_set_version text not null,
  findings_count integer not null default 0 check (findings_count >= 0),
  assessment_created integer not null default 0 check (assessment_created >= 0),
  assessment_updated integer not null default 0 check (assessment_updated >= 0),
  assessment_superseded integer not null default 0 check (assessment_superseded >= 0),
  warnings jsonb not null default '[]'::jsonb,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists finding_priority_evaluation_runs_entity_idx
  on public.finding_priority_evaluation_runs (entity_type, entity_id, completed_at desc);

create table if not exists public.finding_priority_jobs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null default 'fire_event',
  entity_id uuid not null,
  requested_priority_model_version text not null,
  requested_context_version text,
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

create unique index if not exists finding_priority_jobs_active_unique_idx
  on public.finding_priority_jobs (entity_type, entity_id, requested_priority_model_version)
  where status in ('pending', 'processing');

create index if not exists finding_priority_jobs_status_available_idx
  on public.finding_priority_jobs (status, available_at, priority desc);

create or replace function public.claim_finding_priority_job(
  p_worker_id text,
  p_lock_timeout_minutes integer default 30
)
returns setof public.finding_priority_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.finding_priority_jobs;
begin
  update public.finding_priority_jobs
  set
    status = 'pending',
    locked_at = null,
    locked_by = null,
    updated_at = now()
  where status = 'processing'
    and locked_at is not null
    and locked_at < now() - make_interval(mins => greatest(p_lock_timeout_minutes, 1));

  update public.finding_priority_jobs j
  set
    status = 'processing',
    locked_at = now(),
    locked_by = p_worker_id,
    started_at = coalesce(j.started_at, now()),
    attempts = j.attempts + 1,
    updated_at = now()
  where j.id = (
    select id
    from public.finding_priority_jobs
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

alter table public.finding_priority_assessments enable row level security;
alter table public.finding_priority_evaluation_runs enable row level security;
alter table public.finding_priority_jobs enable row level security;
