-- =============================================================================
-- TerraMind — Commit 7B.1: Climate Intelligence Core (almacenamiento)
-- =============================================================================
-- Rama: feature/climate-intelligence-core
-- No integra fire_event_context ni scheduler FIRMS.
-- =============================================================================

create table if not exists public.climate_locations (
  id                  uuid primary key default gen_random_uuid(),
  location_key        text not null unique,
  name                text not null,
  display_name        text not null,
  latitude            double precision not null,
  longitude           double precision not null,
  elevation_m         double precision,
  timezone            text not null default 'America/Guatemala',
  location_type       text not null,
  location_representation text not null default 'point_reference',
  related_entity_type text,
  related_entity_id   text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint climate_locations_lat_chk check (latitude between -90 and 90),
  constraint climate_locations_lng_chk check (longitude between -180 and 180)
);

comment on column public.climate_locations.display_name is
  'Etiqueta humana; para centroides usar punto de referencia, no promedio espacial.';
comment on column public.climate_locations.location_representation is
  'point_reference | station | area_weighted | grid_cell';

create table if not exists public.climate_observations (
  id                      uuid primary key default gen_random_uuid(),
  location_id             uuid not null references public.climate_locations (id) on delete cascade,
  provider                text not null,
  model                   text,
  observed_at             timestamptz not null,
  fetched_at              timestamptz not null default now(),
  temperature_c           double precision,
  relative_humidity_pct   double precision,
  precipitation_mm        double precision,
  rain_mm                 double precision,
  wind_speed_10m_kph      double precision,
  wind_direction_10m_deg  double precision,
  wind_gusts_10m_kph      double precision,
  cloud_cover_pct         double precision,
  surface_pressure_hpa    double precision,
  optional_variables      jsonb not null default '{}'::jsonb,
  source_metadata         jsonb not null default '{}'::jsonb,
  created_at              timestamptz not null default now(),
  constraint climate_observations_unique unique (location_id, provider, observed_at)
);

comment on table public.climate_locations is
  'Ubicaciones climáticas reutilizables (país, departamento, estación, evento, etc.).';

comment on column public.climate_observations.observed_at is
  'Hora UTC del bloque modelado más reciente (model_time_utc); no observación de estación.';

create table if not exists public.climate_forecasts (
  id                            uuid primary key default gen_random_uuid(),
  location_id                   uuid not null references public.climate_locations (id) on delete cascade,
  provider                      text not null,
  model                         text,
  issued_at                     timestamptz not null,
  valid_at                      timestamptz not null,
  fetched_at                    timestamptz not null default now(),
  horizon_hours                 integer,
  temperature_c                 double precision,
  relative_humidity_pct         double precision,
  precipitation_probability_pct double precision,
  precipitation_mm              double precision,
  rain_mm                       double precision,
  wind_speed_10m_kph            double precision,
  wind_direction_10m_deg        double precision,
  wind_gusts_10m_kph            double precision,
  cloud_cover_pct               double precision,
  optional_variables            jsonb not null default '{}'::jsonb,
  source_metadata               jsonb not null default '{}'::jsonb,
  created_at                    timestamptz not null default now(),
  constraint climate_forecasts_unique unique (location_id, provider, issued_at, valid_at)
);

comment on table public.climate_forecasts is
  'Pronóstico horario normalizado; issued_at = momento de emisión del run.';

create table if not exists public.climate_fetch_runs (
  id                  uuid primary key default gen_random_uuid(),
  provider            text not null,
  status              text not null,
  locations_requested integer not null default 0,
  locations_success   integer not null default 0,
  locations_failed    integer not null default 0,
  started_at          timestamptz not null default now(),
  completed_at        timestamptz,
  duration_ms         integer,
  metrics             jsonb not null default '{}'::jsonb,
  error_code          text,
  error_message_safe  text,
  created_at          timestamptz not null default now()
);

comment on table public.climate_fetch_runs is
  'Trazabilidad de corridas de ingesta climática por proveedor.';

create index if not exists climate_observations_location_observed_idx
  on public.climate_observations (location_id, observed_at desc);

create index if not exists climate_forecasts_location_valid_idx
  on public.climate_forecasts (location_id, valid_at);

create index if not exists climate_observations_provider_fetched_idx
  on public.climate_observations (provider, fetched_at desc);

create index if not exists climate_forecasts_provider_fetched_idx
  on public.climate_forecasts (provider, fetched_at desc);

create index if not exists climate_fetch_runs_started_idx
  on public.climate_fetch_runs (started_at desc);

create trigger climate_locations_set_updated_at
  before update on public.climate_locations
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Centroides territoriales para registro de ubicaciones nacionales
-- -----------------------------------------------------------------------------
create or replace function public.geo_list_territorial_centroids()
returns table (
  entity_type text,
  entity_id text,
  name text,
  latitude double precision,
  longitude double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select * from (
    select
      'geo_countries'::text as entity_type,
      gc.code as entity_id,
      gc.name as name,
      extensions.st_y(extensions.st_centroid(gc.boundary))::double precision as latitude,
      extensions.st_x(extensions.st_centroid(gc.boundary))::double precision as longitude
    from public.geo_countries gc
    where gc.code = 'GT'
      and gc.boundary is not null

    union all

    select
      'geo_departments'::text as entity_type,
      gd.country_code || ':' || gd.code as entity_id,
      gd.name as name,
      extensions.st_y(extensions.st_centroid(gd.boundary))::double precision as latitude,
      extensions.st_x(extensions.st_centroid(gd.boundary))::double precision as longitude
    from public.geo_departments gd
    where gd.country_code = 'GT'
      and gd.boundary is not null
  ) c
  order by c.entity_type, c.name;
$$;

revoke all on function public.geo_list_territorial_centroids() from public;
grant execute on function public.geo_list_territorial_centroids() to service_role;

-- -----------------------------------------------------------------------------
-- RLS — lectura pública; escritura solo service_role (backend)
-- -----------------------------------------------------------------------------
alter table public.climate_locations   enable row level security;
alter table public.climate_observations enable row level security;
alter table public.climate_forecasts   enable row level security;
alter table public.climate_fetch_runs  enable row level security;

create policy "climate_locations_read"
  on public.climate_locations for select
  to anon, authenticated
  using (true);

create policy "climate_observations_read"
  on public.climate_observations for select
  to anon, authenticated
  using (true);

create policy "climate_forecasts_read"
  on public.climate_forecasts for select
  to anon, authenticated
  using (true);

create policy "climate_fetch_runs_read"
  on public.climate_fetch_runs for select
  to anon, authenticated
  using (true);

grant select on public.climate_locations to anon, authenticated;
grant select on public.climate_observations to anon, authenticated;
grant select on public.climate_forecasts to anon, authenticated;
grant select on public.climate_fetch_runs to anon, authenticated;

grant all on public.climate_locations to service_role;
grant all on public.climate_observations to service_role;
grant all on public.climate_forecasts to service_role;
grant all on public.climate_fetch_runs to service_role;

-- -----------------------------------------------------------------------------
-- Migraciones posteriores: land cover debe usar 009_land_cover_context.sql
-- -----------------------------------------------------------------------------
