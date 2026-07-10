-- TerraMind — Commit 7A.2: Contexto de cobertura del suelo (borrador)
-- =============================================================================
-- Migración 009 — el agente climático reservó 008_climate_intelligence_core.sql
-- NO aplicar hasta Commit 7A.2-D (tras validación de raster).
-- Rollback: docs/LAND-COVER-INTELLIGENCE.md §12
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Capa territorial raster (catálogo)
-- -----------------------------------------------------------------------------
insert into public.territorial_layers (
  layer_code,
  name,
  category,
  source_organization,
  source_url,
  license,
  source_version,
  source_date,
  geometry_type,
  srid,
  update_frequency,
  metadata,
  is_active
)
values (
  'gt_land_cover',
  'Cobertura del suelo — ESA WorldCover',
  'land_cover',
  'European Space Agency (ESA)',
  'https://esa-worldcover.org/en/data-access',
  'CC-BY-4.0',
  '2021-v200',
  '2021-01-01',
  'Raster',
  4326,
  'static_snapshot',
  jsonb_build_object(
    'reference_year', 2021,
    'resolution_m', 10,
    'doi', '10.5281/zenodo.7254221',
    'mapper_version', 'esa-worldcover-v200-mapper-v1',
    'analysis_method_version', 'laea-zone-stats-v1'
  ),
  false
)
on conflict (layer_code) do nothing;

-- -----------------------------------------------------------------------------
-- Contexto por evento (punto + metadata)
-- -----------------------------------------------------------------------------
create table if not exists public.fire_event_land_cover_context (
  event_id uuid primary key
    references public.fire_events(id) on delete cascade,
  context_version text not null,
  source_layer_id uuid
    references public.territorial_layers(id) on delete set null,
  source_version text not null,
  reference_year integer not null,
  point_distribution jsonb not null default '{}'::jsonb,
  status text not null
    check (status in ('complete', 'partial', 'unavailable', 'error')),
  warnings jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fire_event_land_cover_context_status_idx
  on public.fire_event_land_cover_context (status);

create index if not exists fire_event_land_cover_context_generated_at_idx
  on public.fire_event_land_cover_context (generated_at desc);

-- -----------------------------------------------------------------------------
-- Zonas por radio (extensible)
-- -----------------------------------------------------------------------------
create table if not exists public.fire_event_land_cover_zones (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null
    references public.fire_events(id) on delete cascade,
  radius_m integer not null check (radius_m >= 0),
  context_version text not null,
  dominant_class text,
  class_distribution jsonb not null default '{}'::jsonb,
  herbaceous_wetland_pct numeric,
  mangrove_pct numeric,
  forest_pct numeric,
  cropland_pct numeric,
  built_up_pct numeric,
  permanent_water_pct numeric,
  valid_pixel_count integer not null default 0,
  nodata_pixel_count integer not null default 0,
  data_coverage_pct numeric,
  analyzed_area_ha numeric,
  generated_at timestamptz not null default now(),
  constraint fire_event_land_cover_zones_unique
    unique (event_id, radius_m, context_version)
);

create index if not exists fire_event_land_cover_zones_event_idx
  on public.fire_event_land_cover_zones (event_id);

create index if not exists fire_event_land_cover_zones_event_radius_idx
  on public.fire_event_land_cover_zones (event_id, radius_m);

-- -----------------------------------------------------------------------------
-- RLS: backend-only
-- -----------------------------------------------------------------------------
alter table public.fire_event_land_cover_context enable row level security;
alter table public.fire_event_land_cover_zones enable row level security;

revoke all on table public.fire_event_land_cover_context from anon, authenticated;
revoke all on table public.fire_event_land_cover_zones from anon, authenticated;

grant select, insert, update, delete on table public.fire_event_land_cover_context to service_role;
grant select, insert, update, delete on table public.fire_event_land_cover_zones to service_role;
