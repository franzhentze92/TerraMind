-- 012_population_intelligence_core.sql
-- TerraMind — Núcleo de inteligencia poblacional (7D.2)
-- Orden: 008 climate · 009 land cover · 010 biodiversity (no aplicada) · 011 land cover jobs · 012 population · 013 biodiversity media (no aplicada)
-- Rollback: ver docs/POPULATION-INTELLIGENCE-CORE.md § migración 012

create extension if not exists postgis;

-- -----------------------------------------------------------------------------
-- Catálogo de fuentes
-- -----------------------------------------------------------------------------
create table if not exists public.population_sources (
  id uuid primary key default gen_random_uuid(),
  source_code text not null unique,
  name text not null,
  organization text,
  dataset_name text,
  source_version text not null,
  reference_year integer not null,
  license text,
  attribution text,
  methodology text,
  spatial_resolution_m numeric,
  is_official boolean not null default false,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Estadísticas administrativas oficiales (INE)
-- -----------------------------------------------------------------------------
create table if not exists public.population_admin_statistics (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.population_sources(id) on delete cascade,
  admin_level text not null check (admin_level in ('national', 'department', 'municipality')),
  admin_code text not null,
  department_code text,
  municipality_code text,
  admin_name text not null,
  statistic_type text not null check (statistic_type in ('census', 'projection')),
  reference_year integer not null,
  population_total bigint,
  population_urban bigint,
  population_rural bigint,
  households bigint,
  dwellings bigint,
  is_census boolean not null default false,
  is_projection boolean not null default false,
  projection_method text,
  temporal_alignment text not null default 'exact'
    check (temporal_alignment in ('exact', 'partial', 'nearest', 'mismatch')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, admin_level, admin_code, statistic_type, reference_year)
);

create index if not exists idx_population_admin_statistics_level_code
  on public.population_admin_statistics (admin_level, admin_code);

create index if not exists idx_population_admin_statistics_dept
  on public.population_admin_statistics (department_code);

create index if not exists idx_population_admin_statistics_year
  on public.population_admin_statistics (reference_year);

-- -----------------------------------------------------------------------------
-- Crosswalk de códigos administrativos
-- -----------------------------------------------------------------------------
create table if not exists public.population_admin_crosswalk (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.population_sources(id) on delete cascade,
  admin_level text not null check (admin_level in ('department', 'municipality')),
  source_admin_code text not null,
  canonical_admin_code text not null,
  department_code text,
  municipality_code text,
  official_name text not null,
  normalized_name text not null,
  geometry_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, admin_level, source_admin_code)
);

-- -----------------------------------------------------------------------------
-- Lugares poblados / asentamientos (agregados, sin microdatos)
-- -----------------------------------------------------------------------------
create table if not exists public.population_settlements (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.population_sources(id) on delete cascade,
  source_settlement_id text not null,
  name text not null,
  normalized_name text not null,
  settlement_type text,
  department_code text,
  municipality_code text,
  population_reference bigint,
  population_reference_year integer,
  geom geometry(Point, 4326) not null,
  location_accuracy text not null default 'unknown',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, source_settlement_id)
);

create index if not exists idx_population_settlements_geom
  on public.population_settlements using gist (geom);

create index if not exists idx_population_settlements_muni
  on public.population_settlements (municipality_code);

-- -----------------------------------------------------------------------------
-- Metadatos de rasters (sin píxeles)
-- -----------------------------------------------------------------------------
create table if not exists public.population_raster_datasets (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.population_sources(id) on delete cascade,
  dataset_code text not null,
  reference_year integer not null,
  raster_type text not null default 'population_count',
  population_type text not null default 'resident'
    check (population_type in ('resident', 'present', 'official_census')),
  spatial_resolution_m numeric not null,
  crs text not null,
  storage_reference text not null,
  checksum text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, dataset_code, reference_year)
);

-- -----------------------------------------------------------------------------
-- Contexto por entidad (eventos, áreas, etc.)
-- -----------------------------------------------------------------------------
create table if not exists public.entity_population_context (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  context_version text not null,
  source_dataset_id uuid references public.population_raster_datasets(id) on delete set null,
  reference_year integer not null,
  analysis_geometry_type text,
  estimated_population numeric,
  official_population_context jsonb not null default '{}'::jsonb,
  nearest_settlements jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'complete', 'partial', 'unavailable', 'error')),
  warnings jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id, context_version)
);

create index if not exists idx_entity_population_context_entity
  on public.entity_population_context (entity_type, entity_id);

-- -----------------------------------------------------------------------------
-- Zonas por radio
-- -----------------------------------------------------------------------------
create table if not exists public.entity_population_zones (
  id uuid primary key default gen_random_uuid(),
  context_id uuid not null references public.entity_population_context(id) on delete cascade,
  radius_m integer not null check (radius_m > 0),
  estimated_population numeric not null default 0,
  adjusted_population numeric,
  population_density_per_km2 numeric,
  analyzed_area_ha numeric,
  data_coverage_pct numeric,
  adjustment_factor numeric,
  adjustment_method text,
  generated_at timestamptz not null default now(),
  unique (context_id, radius_m)
);

create index if not exists idx_entity_population_zones_context
  on public.entity_population_zones (context_id);

-- -----------------------------------------------------------------------------
-- RLS — backend only (service role)
-- -----------------------------------------------------------------------------
alter table public.population_sources enable row level security;
alter table public.population_admin_statistics enable row level security;
alter table public.population_admin_crosswalk enable row level security;
alter table public.population_settlements enable row level security;
alter table public.population_raster_datasets enable row level security;
alter table public.entity_population_context enable row level security;
alter table public.entity_population_zones enable row level security;

create policy population_sources_service_all on public.population_sources
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy population_admin_statistics_service_all on public.population_admin_statistics
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy population_admin_crosswalk_service_all on public.population_admin_crosswalk
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy population_settlements_service_all on public.population_settlements
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy population_raster_datasets_service_all on public.population_raster_datasets
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy entity_population_context_service_all on public.entity_population_context
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy entity_population_zones_service_all on public.entity_population_zones
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

comment on table public.population_sources is
  'Catálogo de fuentes oficiales (INE) y modeladas (WorldPop, GHSL).';

comment on table public.population_admin_statistics is
  'Cifras oficiales administrativas; no sustituyen estimación raster.';

comment on table public.population_settlements is
  'Lugares poblados agregados (sin microdatos ni viviendas individuales).';

comment on column public.entity_population_zones.adjustment_factor is
  'factor = proyección_INE_año_raster / suma_raster_municipio; NULL si años incompatibles.';
