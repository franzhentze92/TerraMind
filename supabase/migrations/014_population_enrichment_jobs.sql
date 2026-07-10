-- 014_population_enrichment_jobs.sql
-- TerraMind — Jobs de enriquecimiento poblacional para eventos (7D.3)
-- Rollback: DROP FUNCTION claim_population_enrichment_job; DROP TABLE population_enrichment_jobs;
-- ALTER TABLE entity_population_context DROP COLUMN IF EXISTS geometry_source;
-- ALTER TABLE entity_population_context DROP COLUMN IF EXISTS validation_summary;
-- ALTER TABLE entity_population_zones DROP COLUMN IF EXISTS validation_estimate;
-- ALTER TABLE entity_population_zones DROP COLUMN IF EXISTS absolute_difference;
-- ALTER TABLE entity_population_zones DROP COLUMN IF EXISTS difference_pct;
-- ALTER TABLE entity_population_zones DROP COLUMN IF EXISTS warnings;

-- Campos adicionales en contexto persistido
alter table public.entity_population_context
  add column if not exists geometry_source text
    check (geometry_source is null or geometry_source in ('detections', 'event_centroid_fallback'));

alter table public.entity_population_context
  add column if not exists validation_summary jsonb not null default '{}'::jsonb;

-- Campos adicionales por radio
alter table public.entity_population_zones
  add column if not exists validation_estimate numeric;

alter table public.entity_population_zones
  add column if not exists absolute_difference numeric;

alter table public.entity_population_zones
  add column if not exists difference_pct numeric;

alter table public.entity_population_zones
  add column if not exists warnings jsonb not null default '[]'::jsonb;

create table if not exists public.population_enrichment_jobs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null default 'fire_event',
  entity_id uuid not null,
  requested_context_version text not null,
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

create unique index if not exists population_enrichment_jobs_active_unique_idx
  on public.population_enrichment_jobs (entity_type, entity_id, requested_context_version)
  where status in ('pending', 'processing');

create index if not exists population_enrichment_jobs_status_available_idx
  on public.population_enrichment_jobs (status, available_at, priority desc);

create index if not exists population_enrichment_jobs_entity_idx
  on public.population_enrichment_jobs (entity_type, entity_id);

create index if not exists population_enrichment_jobs_locked_at_idx
  on public.population_enrichment_jobs (locked_at)
  where status = 'processing';

create or replace function public.claim_population_enrichment_job(
  p_worker_id text,
  p_lock_timeout_minutes integer default 30
)
returns setof public.population_enrichment_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.population_enrichment_jobs;
begin
  update public.population_enrichment_jobs
  set
    status = 'pending',
    locked_at = null,
    locked_by = null,
    updated_at = now()
  where status = 'processing'
    and locked_at is not null
    and locked_at < now() - make_interval(mins => greatest(p_lock_timeout_minutes, 1));

  update public.population_enrichment_jobs j
  set
    status = 'processing',
    locked_at = now(),
    locked_by = p_worker_id,
    started_at = coalesce(j.started_at, now()),
    attempts = j.attempts + 1,
    updated_at = now()
  where j.id = (
    select id
    from public.population_enrichment_jobs
    where status = 'pending'
      and available_at <= now()
      and attempts < max_attempts
    order by priority desc, available_at asc, created_at asc
    limit 1
    for update skip locked
  )
  returning * into v_job;

  if found then
    return next v_job;
  end if;
end;
$$;

revoke all on function public.claim_population_enrichment_job(text, integer) from public;
grant execute on function public.claim_population_enrichment_job(text, integer) to service_role;

alter table public.population_enrichment_jobs enable row level security;
revoke all on table public.population_enrichment_jobs from anon, authenticated;
grant select, insert, update, delete on table public.population_enrichment_jobs to service_role;

create policy population_enrichment_jobs_service_all on public.population_enrichment_jobs
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
