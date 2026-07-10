-- 025_evidence_validation.sql
-- TerraMind — Evidence Quality & Validation (8B.5)

create table if not exists public.evidence_validations (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.evidence_submissions (id) on delete cascade,
  validation_model_version text not null default '1.0.0',
  status text not null check (status in (
    'pending', 'validating', 'accepted', 'accepted_with_limitations',
    'inconclusive', 'rejected', 'superseded', 'withdrawn'
  )),
  decision_reason text not null default '',
  decision_rules jsonb not null default '[]'::jsonb,
  rejection_reason_code text,
  limitations jsonb not null default '[]'::jsonb,
  recommended_follow_up jsonb not null default '[]'::jsonb,
  evidence_strength text not null check (evidence_strength in (
    'very_low', 'low', 'moderate', 'strong', 'very_strong'
  )),
  technical_integrity_score integer not null default 0 check (technical_integrity_score between 0 and 100),
  provenance_score integer not null default 0 check (provenance_score between 0 and 100),
  temporal_relevance_score integer not null default 0 check (temporal_relevance_score between 0 and 100),
  spatial_relevance_score integer not null default 0 check (spatial_relevance_score between 0 and 100),
  semantic_relevance_score integer not null default 0 check (semantic_relevance_score between 0 and 100),
  completeness_score integer not null default 0 check (completeness_score between 0 and 100),
  source_independence_score integer not null default 0 check (source_independence_score between 0 and 100),
  usability_score integer not null default 0 check (usability_score between 0 and 100),
  overall_quality_score integer not null default 0 check (overall_quality_score between 0 and 100),
  score_explanation jsonb not null default '{}'::jsonb,
  context_signature text not null,
  is_active boolean not null default true,
  superseded_by_validation_id uuid references public.evidence_validations (id),
  supersedes_validation_id uuid references public.evidence_validations (id),
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists evidence_validations_active_unique_idx
  on public.evidence_validations (submission_id, validation_model_version)
  where is_active = true;

create index if not exists evidence_validations_submission_idx
  on public.evidence_validations (submission_id, created_at desc);

create table if not exists public.evidence_validation_checks (
  id uuid primary key default gen_random_uuid(),
  validation_id uuid not null references public.evidence_validations (id) on delete cascade,
  dimension text not null,
  check_code text not null,
  outcome text not null check (outcome in ('passed', 'failed', 'not_applicable', 'warning')),
  message text not null default '',
  weight numeric not null default 1,
  created_at timestamptz not null default now()
);

create unique index if not exists evidence_validation_checks_unique_idx
  on public.evidence_validation_checks (validation_id, check_code);

create table if not exists public.evidence_validation_events (
  id uuid primary key default gen_random_uuid(),
  validation_id uuid not null references public.evidence_validations (id) on delete cascade,
  submission_id uuid not null references public.evidence_submissions (id) on delete cascade,
  event_type text not null,
  actor_type text not null check (actor_type in ('system', 'user')),
  actor_id text,
  payload jsonb not null default '{}'::jsonb,
  validation_model_version text not null default '1.0.0',
  created_at timestamptz not null default now()
);

create index if not exists evidence_validation_events_submission_idx
  on public.evidence_validation_events (submission_id, created_at desc);

create table if not exists public.evidence_validation_evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null,
  validation_id uuid,
  action text not null,
  context_signature text not null,
  validation_model_version text not null default '1.0.0',
  idempotency_key text,
  decision text not null,
  warnings jsonb not null default '[]'::jsonb,
  evaluated_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index if not exists evidence_validation_eval_idempotency_idx
  on public.evidence_validation_evaluation_runs (submission_id, action, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists evidence_validation_eval_context_idx
  on public.evidence_validation_evaluation_runs (submission_id, context_signature, validation_model_version);

create table if not exists public.evidence_validation_jobs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.evidence_submissions (id) on delete cascade,
  validation_model_version text not null default '1.0.0',
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

create unique index if not exists evidence_validation_jobs_pending_idx
  on public.evidence_validation_jobs (submission_id, validation_model_version, context_signature)
  where status in ('pending', 'processing');

create table if not exists public.evidence_conflict_flags (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  submission_id_a uuid not null references public.evidence_submissions (id) on delete cascade,
  submission_id_b uuid not null references public.evidence_submissions (id) on delete cascade,
  conflict_type text not null,
  conflict_field text,
  description text not null default '',
  status text not null default 'potential' check (status in ('potential', 'acknowledged', 'resolved')),
  detected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists evidence_conflict_flags_pair_idx
  on public.evidence_conflict_flags (mission_id, submission_id_a, submission_id_b, conflict_type, conflict_field);

create table if not exists public.verification_resolution_candidates (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  trigger_reason text not null default '',
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists verification_resolution_candidates_pending_idx
  on public.verification_resolution_candidates (mission_id)
  where status = 'pending';

alter table public.evidence_requirement_links
  add column if not exists valid_coverage_status text
    check (valid_coverage_status is null or valid_coverage_status in (
      'valid_coverage', 'valid_partial_coverage', 'inconclusive_coverage',
      'invalid_coverage', 'superseded_coverage'
    ));

create or replace function public.claim_evidence_validation_job(
  p_worker_id text,
  p_lock_timeout_minutes integer default 30
)
returns setof public.evidence_validation_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.evidence_validation_jobs;
begin
  update public.evidence_validation_jobs
  set status = 'pending', locked_at = null, locked_by = null, updated_at = now()
  where status = 'processing'
    and locked_at is not null
    and locked_at < now() - make_interval(mins => greatest(p_lock_timeout_minutes, 1));

  update public.evidence_validation_jobs j
  set status = 'processing', locked_at = now(), locked_by = p_worker_id,
      started_at = coalesce(j.started_at, now()), attempts = j.attempts + 1, updated_at = now()
  where j.id = (
    select id from public.evidence_validation_jobs
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

alter table public.evidence_validations enable row level security;
alter table public.evidence_validation_checks enable row level security;
alter table public.evidence_validation_events enable row level security;
alter table public.evidence_validation_evaluation_runs enable row level security;
alter table public.evidence_validation_jobs enable row level security;
alter table public.evidence_conflict_flags enable row level security;
alter table public.verification_resolution_candidates enable row level security;
