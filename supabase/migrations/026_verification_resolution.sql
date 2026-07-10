-- 026_verification_resolution.sql
-- TerraMind — Verification Resolution Engine (8B.6)

alter table public.verification_plans drop constraint if exists verification_plans_status_check;
alter table public.verification_plans add constraint verification_plans_status_check
  check (status in (
    'draft', 'ready', 'in_progress', 'partially_satisfied', 'satisfied',
    'inconclusive', 'blocked', 'not_required', 'superseded', 'cancelled'
  ));

alter table public.verification_needs
  add column if not exists resolution_status text not null default 'open'
    check (resolution_status in (
      'open', 'partially_satisfied', 'satisfied', 'inconclusive',
      'insufficient_evidence', 'conflicting_evidence', 'blocked',
      'superseded', 'cancelled'
    ));

create table if not exists public.verification_need_resolutions (
  id uuid primary key default gen_random_uuid(),
  verification_need_id uuid not null references public.verification_needs (id) on delete cascade,
  plan_id uuid not null references public.verification_plans (id) on delete cascade,
  incident_id uuid not null references public.incidents (id),
  resolution_model_version text not null default '1.0.0',
  resolution_status text not null,
  resolution_confidence numeric not null default 0 check (resolution_confidence between 0 and 100),
  resolution_strength text not null check (resolution_strength in (
    'very_low', 'low', 'moderate', 'strong', 'very_strong'
  )),
  resolution_reasons jsonb not null default '[]'::jsonb,
  resolution_limitations jsonb not null default '[]'::jsonb,
  remaining_uncertainties jsonb not null default '[]'::jsonb,
  recommended_follow_up jsonb not null default '[]'::jsonb,
  alternative_method_recommended text,
  evidence_bundle jsonb not null default '{}'::jsonb,
  requirements_coverage jsonb not null default '[]'::jsonb,
  conflict_assessment jsonb not null default '{}'::jsonb,
  evidence_sufficiency_score integer not null default 0 check (evidence_sufficiency_score between 0 and 100),
  coverage_score integer not null default 0 check (coverage_score between 0 and 100),
  corroboration_score integer not null default 0 check (corroboration_score between 0 and 100),
  conflict_penalty integer not null default 0 check (conflict_penalty between 0 and 100),
  temporal_fit_score integer not null default 0 check (temporal_fit_score between 0 and 100),
  spatial_fit_score integer not null default 0 check (spatial_fit_score between 0 and 100),
  resolution_confidence_score integer not null default 0 check (resolution_confidence_score between 0 and 100),
  context_signature text not null,
  is_active boolean not null default true,
  previous_resolution_id uuid references public.verification_need_resolutions (id),
  superseded_by_resolution_id uuid references public.verification_need_resolutions (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists verification_need_resolutions_active_idx
  on public.verification_need_resolutions (verification_need_id, resolution_model_version)
  where is_active = true;

create index if not exists verification_need_resolutions_plan_idx
  on public.verification_need_resolutions (plan_id, created_at desc);

create table if not exists public.verification_resolution_evidence_links (
  id uuid primary key default gen_random_uuid(),
  resolution_id uuid not null references public.verification_need_resolutions (id) on delete cascade,
  submission_id uuid not null references public.evidence_submissions (id) on delete cascade,
  validation_id uuid references public.evidence_validations (id) on delete set null,
  link_role text not null check (link_role in ('used', 'discarded')),
  discard_reason text,
  created_at timestamptz not null default now()
);

create unique index if not exists verification_resolution_evidence_unique_idx
  on public.verification_resolution_evidence_links (resolution_id, submission_id);

create table if not exists public.verification_resolution_events (
  id uuid primary key default gen_random_uuid(),
  resolution_id uuid not null references public.verification_need_resolutions (id) on delete cascade,
  need_id uuid not null references public.verification_needs (id) on delete cascade,
  plan_id uuid not null references public.verification_plans (id) on delete cascade,
  event_type text not null,
  actor_type text not null check (actor_type in ('system', 'user')),
  actor_id text,
  payload jsonb not null default '{}'::jsonb,
  resolution_model_version text not null default '1.0.0',
  created_at timestamptz not null default now()
);

create table if not exists public.verification_resolution_evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  verification_need_id uuid not null,
  resolution_id uuid,
  action text not null,
  context_signature text not null,
  resolution_model_version text not null default '1.0.0',
  idempotency_key text,
  decision text not null,
  warnings jsonb not null default '[]'::jsonb,
  evaluated_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index if not exists verification_resolution_eval_idempotency_idx
  on public.verification_resolution_evaluation_runs (verification_need_id, action, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists verification_resolution_eval_context_idx
  on public.verification_resolution_evaluation_runs (verification_need_id, context_signature, resolution_model_version);

create table if not exists public.verification_resolution_jobs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.verification_plans (id) on delete cascade,
  mission_id uuid references public.missions (id) on delete set null,
  resolution_model_version text not null default '1.0.0',
  context_signature text not null default '',
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

create unique index if not exists verification_resolution_jobs_pending_idx
  on public.verification_resolution_jobs (plan_id, resolution_model_version, context_signature)
  where status in ('pending', 'processing');

create table if not exists public.verification_plan_resolution_history (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.verification_plans (id) on delete cascade,
  from_status text,
  to_status text not null,
  reason text not null default '',
  need_summary jsonb not null default '{}'::jsonb,
  resolution_model_version text not null default '1.0.0',
  created_at timestamptz not null default now()
);

create table if not exists public.resolution_reevaluation_requests (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  plan_id uuid not null references public.verification_plans (id) on delete cascade,
  need_id uuid references public.verification_needs (id) on delete set null,
  resolution_id uuid references public.verification_need_resolutions (id) on delete set null,
  effect_type text not null check (effect_type in (
    'finding_reevaluation_requested',
    'priority_reevaluation_requested',
    'lifecycle_reevaluation_requested',
    'incident_reevaluation_requested',
    'verification_replanning_requested'
  )),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed')),
  context_signature text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists resolution_reevaluation_unique_idx
  on public.resolution_reevaluation_requests (resolution_id, effect_type)
  where resolution_id is not null;

create or replace function public.claim_verification_resolution_job(
  p_worker_id text,
  p_lock_timeout_minutes integer default 30
)
returns setof public.verification_resolution_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.verification_resolution_jobs;
begin
  update public.verification_resolution_jobs
  set status = 'pending', locked_at = null, locked_by = null, updated_at = now()
  where status = 'processing'
    and locked_at is not null
    and locked_at < now() - make_interval(mins => greatest(p_lock_timeout_minutes, 1));

  update public.verification_resolution_jobs j
  set status = 'processing', locked_at = now(), locked_by = p_worker_id,
      started_at = coalesce(j.started_at, now()), attempts = j.attempts + 1, updated_at = now()
  where j.id = (
    select id from public.verification_resolution_jobs
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

alter table public.verification_need_resolutions enable row level security;
alter table public.verification_resolution_evidence_links enable row level security;
alter table public.verification_resolution_events enable row level security;
alter table public.verification_resolution_evaluation_runs enable row level security;
alter table public.verification_resolution_jobs enable row level security;
alter table public.verification_plan_resolution_history enable row level security;
alter table public.resolution_reevaluation_requests enable row level security;
