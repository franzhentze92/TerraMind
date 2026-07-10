-- 021_verification_planning.sql
-- TerraMind — Verification Planning Engine (8B.1)

create table if not exists public.verification_plans (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id),
  status text not null
    check (status in ('draft', 'ready', 'not_required', 'blocked', 'superseded', 'satisfied', 'cancelled')),
  verification_model_version text not null,
  incident_snapshot jsonb not null default '{}'::jsonb,
  plan_priority integer not null default 0 check (plan_priority >= 0 and plan_priority <= 100),
  plan_reasons jsonb not null default '[]'::jsonb,
  plan_limitations jsonb not null default '[]'::jsonb,
  recommended_window jsonb not null default '{}'::jsonb,
  evidence_requirements jsonb not null default '[]'::jsonb,
  context_signature text not null,
  previous_plan_id uuid references public.verification_plans (id),
  mission_candidate_pending boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  superseded_at timestamptz
);

create unique index if not exists verification_plans_active_unique_idx
  on public.verification_plans (incident_id, verification_model_version)
  where status in ('draft', 'ready', 'not_required', 'blocked');

create index if not exists verification_plans_incident_idx
  on public.verification_plans (incident_id, created_at desc);

create index if not exists verification_plans_priority_idx
  on public.verification_plans (status, plan_priority desc, created_at desc);

create table if not exists public.verification_needs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.verification_plans (id) on delete cascade,
  need_type text not null,
  need_question text not null,
  priority integer not null default 0,
  derivation_reasons jsonb not null default '[]'::jsonb,
  evidence_minimum jsonb not null default '[]'::jsonb,
  success_criteria jsonb not null default '{}'::jsonb,
  inconclusive_criteria jsonb not null default '{}'::jsonb,
  failure_criteria jsonb not null default '{}'::jsonb,
  recommended_window jsonb not null default '{}'::jsonb,
  recommended_method_id text,
  alternative_method_ids jsonb not null default '[]'::jsonb,
  selection_reason text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists verification_needs_plan_idx
  on public.verification_needs (plan_id, priority desc);

create table if not exists public.verification_method_candidates (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.verification_plans (id) on delete cascade,
  need_id uuid references public.verification_needs (id) on delete cascade,
  method_id text not null,
  method_type text not null,
  is_recommended boolean not null default false,
  is_alternative boolean not null default false,
  is_blocked boolean not null default false,
  suitability_score numeric(5, 4) not null default 0,
  information_gain_score numeric(5, 4) not null default 0,
  urgency_fit_score numeric(5, 4) not null default 0,
  cost_efficiency_score numeric(5, 4) not null default 0,
  availability_score numeric(5, 4) not null default 0,
  evidence_strength_score numeric(5, 4) not null default 0,
  ranking_reasons jsonb not null default '[]'::jsonb,
  ranking_limitations jsonb not null default '[]'::jsonb,
  constraints jsonb not null default '[]'::jsonb,
  method_catalog_version text not null,
  created_at timestamptz not null default now()
);

create index if not exists verification_method_candidates_plan_idx
  on public.verification_method_candidates (plan_id, need_id);

create table if not exists public.verification_plan_evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null,
  verification_model_version text not null,
  context_signature text not null,
  plan_id uuid references public.verification_plans (id),
  plan_status text not null,
  needs_count integer not null default 0,
  methods_count integer not null default 0,
  mission_candidate_pending boolean not null default false,
  warnings jsonb not null default '[]'::jsonb,
  evaluated_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index if not exists verification_plan_runs_signature_idx
  on public.verification_plan_evaluation_runs (incident_id, context_signature);

create table if not exists public.verification_plan_jobs (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null,
  requested_verification_model_version text not null,
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

create unique index if not exists verification_plan_jobs_active_unique_idx
  on public.verification_plan_jobs (incident_id, requested_verification_model_version)
  where status in ('pending', 'processing');

create index if not exists verification_plan_jobs_status_idx
  on public.verification_plan_jobs (status, available_at, priority desc);

create or replace function public.claim_verification_plan_job(
  p_worker_id text,
  p_lock_timeout_minutes integer default 30
)
returns setof public.verification_plan_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.verification_plan_jobs;
begin
  update public.verification_plan_jobs
  set status = 'pending', locked_at = null, locked_by = null, updated_at = now()
  where status = 'processing'
    and locked_at is not null
    and locked_at < now() - make_interval(mins => greatest(p_lock_timeout_minutes, 1));

  update public.verification_plan_jobs j
  set status = 'processing', locked_at = now(), locked_by = p_worker_id,
      started_at = coalesce(j.started_at, now()), attempts = j.attempts + 1, updated_at = now()
  where j.id = (
    select id from public.verification_plan_jobs
    where status = 'pending' and available_at <= now() and attempts < max_attempts
    order by priority desc, available_at asc, created_at asc
    limit 1 for update skip locked
  )
  returning * into v_job;

  if v_job.id is not null then return next v_job; end if;
  return;
end;
$$;

alter table public.verification_plans enable row level security;
alter table public.verification_needs enable row level security;
alter table public.verification_method_candidates enable row level security;
alter table public.verification_plan_evaluation_runs enable row level security;
alter table public.verification_plan_jobs enable row level security;
