-- 017_composite_findings.sql
-- TerraMind — Motor de hallazgos compuestos (8A.1)
-- Rollback:
--   DROP FUNCTION IF EXISTS claim_finding_evaluation_job;
--   DROP TABLE IF EXISTS finding_evaluation_runs;
--   DROP TABLE IF EXISTS finding_evaluation_jobs;
--   DROP TABLE IF EXISTS composite_findings;

create table if not exists public.composite_findings (
  id uuid primary key default gen_random_uuid(),
  finding_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  title text not null,
  summary text not null,
  status text not null
    check (status in ('active', 'monitoring', 'resolved', 'superseded', 'dismissed')),
  severity_label text not null
    check (severity_label in ('informational', 'attention', 'elevated_attention')),
  confidence jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  triggered_rules jsonb not null default '[]'::jsonb,
  source_domains jsonb not null default '[]'::jsonb,
  geographic_context jsonb not null default '{}'::jsonb,
  temporal_context jsonb not null default '{}'::jsonb,
  limitations jsonb not null default '[]'::jsonb,
  recommended_actions jsonb not null default '[]'::jsonb,
  context_version text not null,
  rule_set_version text not null,
  generated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists composite_findings_active_unique_idx
  on public.composite_findings (entity_type, entity_id, finding_type, rule_set_version)
  where status in ('active', 'monitoring');

create index if not exists composite_findings_entity_idx
  on public.composite_findings (entity_type, entity_id, generated_at desc);

create index if not exists composite_findings_status_idx
  on public.composite_findings (status, generated_at desc);

create index if not exists composite_findings_type_idx
  on public.composite_findings (finding_type, generated_at desc);

create table if not exists public.finding_evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  rule_set_version text not null,
  context_version text not null,
  contexts_available jsonb not null default '{}'::jsonb,
  rules_evaluated integer not null default 0 check (rules_evaluated >= 0),
  findings_created integer not null default 0 check (findings_created >= 0),
  findings_updated integer not null default 0 check (findings_updated >= 0),
  findings_resolved integer not null default 0 check (findings_resolved >= 0),
  warnings jsonb not null default '[]'::jsonb,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists finding_evaluation_runs_entity_idx
  on public.finding_evaluation_runs (entity_type, entity_id, completed_at desc);

create table if not exists public.finding_evaluation_jobs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null default 'fire_event',
  entity_id uuid not null,
  requested_rule_set_version text not null,
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

create unique index if not exists finding_evaluation_jobs_active_unique_idx
  on public.finding_evaluation_jobs (entity_type, entity_id, requested_rule_set_version)
  where status in ('pending', 'processing');

create index if not exists finding_evaluation_jobs_status_available_idx
  on public.finding_evaluation_jobs (status, available_at, priority desc);

create or replace function public.claim_finding_evaluation_job(
  p_worker_id text,
  p_lock_timeout_minutes integer default 30
)
returns setof public.finding_evaluation_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.finding_evaluation_jobs;
begin
  update public.finding_evaluation_jobs
  set
    status = 'pending',
    locked_at = null,
    locked_by = null,
    updated_at = now()
  where status = 'processing'
    and locked_at is not null
    and locked_at < now() - make_interval(mins => greatest(p_lock_timeout_minutes, 1));

  update public.finding_evaluation_jobs j
  set
    status = 'processing',
    locked_at = now(),
    locked_by = p_worker_id,
    started_at = coalesce(j.started_at, now()),
    attempts = j.attempts + 1,
    updated_at = now()
  where j.id = (
    select id
    from public.finding_evaluation_jobs
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

alter table public.composite_findings enable row level security;
alter table public.finding_evaluation_runs enable row level security;
alter table public.finding_evaluation_jobs enable row level security;
