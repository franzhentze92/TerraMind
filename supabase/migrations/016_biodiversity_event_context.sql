-- 016_biodiversity_event_context.sql
-- TerraMind — Contexto de biodiversidad documentada para eventos (7C.5)
-- Depende de: fire_events (existente). No requiere 010/013 (almacén nacional / media global).
-- Rollback:
--   DROP FUNCTION IF EXISTS claim_biodiversity_enrichment_job;
--   DROP TABLE IF EXISTS biodiversity_enrichment_jobs;
--   DROP TABLE IF EXISTS entity_biodiversity_visual_highlights;
--   DROP TABLE IF EXISTS entity_biodiversity_zones;
--   DROP TABLE IF EXISTS entity_biodiversity_context;

create table if not exists public.entity_biodiversity_context (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null default 'fire_event',
  entity_id uuid not null,
  context_version text not null,
  status text not null
    check (status in ('complete', 'partial', 'unavailable', 'error', 'stale')),
  geometry_source text
    check (geometry_source is null or geometry_source in ('detections_union', 'event_centroid_fallback')),
  event_time timestamptz,
  history_start timestamptz,
  history_end timestamptz,
  provider_status jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  quality jsonb not null default '{}'::jsonb,
  monitored_zone_context jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id, context_version)
);

create index if not exists entity_biodiversity_context_entity_idx
  on public.entity_biodiversity_context (entity_type, entity_id, generated_at desc);

create table if not exists public.entity_biodiversity_zones (
  id uuid primary key default gen_random_uuid(),
  context_id uuid not null references public.entity_biodiversity_context (id) on delete cascade,
  radius_m integer not null check (radius_m > 0),
  unique_species_documented integer not null default 0 check (unique_species_documented >= 0),
  observations_documented integer not null default 0 check (observations_documented >= 0),
  observations_recent_30d integer not null default 0 check (observations_recent_30d >= 0),
  observations_recent_90d integer not null default 0 check (observations_recent_90d >= 0),
  event_window_observations integer not null default 0 check (event_window_observations >= 0),
  gbif_count integer not null default 0 check (gbif_count >= 0),
  inaturalist_count integer not null default 0 check (inaturalist_count >= 0),
  research_grade_inaturalist integer not null default 0 check (research_grade_inaturalist >= 0),
  generalized_count integer not null default 0 check (generalized_count >= 0),
  obscured_count integer not null default 0 check (obscured_count >= 0),
  spatially_excluded_count integer not null default 0 check (spatially_excluded_count >= 0),
  duplicated_count integer not null default 0 check (duplicated_count >= 0),
  media_usable_count integer not null default 0 check (media_usable_count >= 0),
  latest_observation_at timestamptz,
  taxa_distribution jsonb not null default '{}'::jsonb,
  data_quality jsonb not null default '{}'::jsonb,
  truncated boolean not null default false,
  warnings jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (context_id, radius_m)
);

create index if not exists entity_biodiversity_zones_context_idx
  on public.entity_biodiversity_zones (context_id, radius_m);

create table if not exists public.entity_biodiversity_visual_highlights (
  id uuid primary key default gen_random_uuid(),
  context_id uuid not null references public.entity_biodiversity_context (id) on delete cascade,
  sort_order integer not null default 0,
  source text not null check (source in ('gbif', 'inaturalist')),
  source_occurrence_id text not null,
  taxon_name text not null,
  common_name text,
  taxonomic_group text not null,
  thumbnail_url text,
  image_url text,
  image_license text,
  image_attribution text,
  observation_url text,
  observed_at timestamptz,
  privacy_status text not null default 'unknown_precision',
  created_at timestamptz not null default now()
);

create index if not exists entity_biodiversity_visual_highlights_context_idx
  on public.entity_biodiversity_visual_highlights (context_id, sort_order);

create table if not exists public.biodiversity_enrichment_jobs (
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

create unique index if not exists biodiversity_enrichment_jobs_active_unique_idx
  on public.biodiversity_enrichment_jobs (entity_type, entity_id, requested_context_version)
  where status in ('pending', 'processing');

create index if not exists biodiversity_enrichment_jobs_status_available_idx
  on public.biodiversity_enrichment_jobs (status, available_at, priority desc);

create index if not exists biodiversity_enrichment_jobs_entity_idx
  on public.biodiversity_enrichment_jobs (entity_type, entity_id);

create or replace function public.claim_biodiversity_enrichment_job(
  p_worker_id text,
  p_lock_timeout_minutes integer default 30
)
returns setof public.biodiversity_enrichment_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.biodiversity_enrichment_jobs;
begin
  update public.biodiversity_enrichment_jobs
  set
    status = 'pending',
    locked_at = null,
    locked_by = null,
    updated_at = now()
  where status = 'processing'
    and locked_at is not null
    and locked_at < now() - make_interval(mins => greatest(p_lock_timeout_minutes, 1));

  update public.biodiversity_enrichment_jobs j
  set
    status = 'processing',
    locked_at = now(),
    locked_by = p_worker_id,
    started_at = coalesce(j.started_at, now()),
    attempts = j.attempts + 1,
    updated_at = now()
  where j.id = (
    select id
    from public.biodiversity_enrichment_jobs
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

alter table public.entity_biodiversity_context enable row level security;
alter table public.entity_biodiversity_zones enable row level security;
alter table public.entity_biodiversity_visual_highlights enable row level security;
alter table public.biodiversity_enrichment_jobs enable row level security;
