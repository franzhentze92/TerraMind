-- 015_climate_event_context.sql
-- TerraMind — Contexto climático persistido para eventos (7B.2)
-- Rollback: DROP FUNCTION claim_climate_enrichment_job; DROP TABLE climate_enrichment_jobs;
-- DROP TABLE entity_climate_context_points; DROP TABLE entity_climate_context;

create table if not exists public.entity_climate_context (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null default 'fire_event',
  entity_id uuid not null,
  context_version text not null,
  status text not null
    check (status in ('complete', 'partial', 'unavailable', 'error', 'stale')),
  provider text not null default 'open_meteo',
  model_name text not null default 'open-meteo-forecast',
  generated_at timestamptz not null,
  event_time_start timestamptz,
  event_time_end timestamptz,
  geometry_source text
    check (geometry_source is null or geometry_source in ('detections_sample', 'event_centroid_fallback')),
  point_count integer not null default 0 check (point_count >= 0),
  temporal_alignment text
    check (temporal_alignment is null or temporal_alignment in ('exact', 'partial', 'mismatch')),
  conditions_summary jsonb not null default '{}'::jsonb,
  antecedent_summary jsonb not null default '{}'::jsonb,
  forecast_summary jsonb not null default '{}'::jsonb,
  source_metadata jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id, context_version)
);

create index if not exists entity_climate_context_entity_idx
  on public.entity_climate_context (entity_type, entity_id, generated_at desc);

create table if not exists public.entity_climate_context_points (
  id uuid primary key default gen_random_uuid(),
  context_id uuid not null references public.entity_climate_context (id) on delete cascade,
  point_role text not null
    check (point_role in ('first_detection', 'last_detection', 'spatial_extreme', 'centroid_fallback')),
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  event_timestamp timestamptz not null,
  matched_weather_timestamp timestamptz,
  temporal_offset_minutes numeric,
  conditions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists entity_climate_context_points_context_idx
  on public.entity_climate_context_points (context_id);

create table if not exists public.climate_enrichment_jobs (
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

create unique index if not exists climate_enrichment_jobs_active_unique_idx
  on public.climate_enrichment_jobs (entity_type, entity_id, requested_context_version)
  where status in ('pending', 'processing');

create index if not exists climate_enrichment_jobs_status_available_idx
  on public.climate_enrichment_jobs (status, available_at, priority desc);

create index if not exists climate_enrichment_jobs_entity_idx
  on public.climate_enrichment_jobs (entity_type, entity_id);

create or replace function public.claim_climate_enrichment_job(
  p_worker_id text,
  p_lock_timeout_minutes integer default 30
)
returns setof public.climate_enrichment_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.climate_enrichment_jobs;
begin
  update public.climate_enrichment_jobs
  set
    status = 'pending',
    locked_at = null,
    locked_by = null,
    updated_at = now()
  where status = 'processing'
    and locked_at is not null
    and locked_at < now() - make_interval(mins => greatest(p_lock_timeout_minutes, 1));

  update public.climate_enrichment_jobs j
  set
    status = 'processing',
    locked_at = now(),
    locked_by = p_worker_id,
    started_at = coalesce(j.started_at, now()),
    attempts = j.attempts + 1,
    updated_at = now()
  where j.id = (
    select id
    from public.climate_enrichment_jobs
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

revoke all on function public.claim_climate_enrichment_job(text, integer) from public;
grant execute on function public.claim_climate_enrichment_job(text, integer) to service_role;

alter table public.entity_climate_context enable row level security;
alter table public.entity_climate_context_points enable row level security;
alter table public.climate_enrichment_jobs enable row level security;

revoke all on table public.entity_climate_context from anon, authenticated;
revoke all on table public.entity_climate_context_points from anon, authenticated;
revoke all on table public.climate_enrichment_jobs from anon, authenticated;

grant select, insert, update, delete on table public.entity_climate_context to service_role;
grant select, insert, update, delete on table public.entity_climate_context_points to service_role;
grant select, insert, update, delete on table public.climate_enrichment_jobs to service_role;

create policy entity_climate_context_service_all on public.entity_climate_context
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy entity_climate_context_points_service_all on public.entity_climate_context_points
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy climate_enrichment_jobs_service_all on public.climate_enrichment_jobs
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
