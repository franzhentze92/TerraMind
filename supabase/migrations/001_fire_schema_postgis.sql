-- =============================================================================
-- TerraMind — Commit 1: Schema FIRMS + PostGIS (v2 — revisión seguridad)
-- =============================================================================
-- REVISAR ANTES DE EJECUTAR en Supabase SQL Editor o via supabase db push
--
-- Rollback al final de este archivo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Extensiones
-- -----------------------------------------------------------------------------
create schema if not exists extensions;

-- PostGIS ya habilitado en extensions no se reinstala; IF NOT EXISTS es idempotente.
create extension if not exists postgis with schema extensions;

-- -----------------------------------------------------------------------------
-- 0b. Funciones utilitarias
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.fire_detections_sync_location()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.location := extensions.st_setsrid(
    extensions.st_makepoint(new.longitude::float8, new.latitude::float8),
    4326
  )::geography;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. Tablas geográficas de referencia (vacías hasta Commit 3)
-- -----------------------------------------------------------------------------
create table if not exists public.geo_countries (
  id            uuid primary key default gen_random_uuid(),
  code          text not null,
  name          text not null,
  boundary      geometry(MultiPolygon, 4326),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint geo_countries_code_unique unique (code)
);

comment on table public.geo_countries is
  'Países con polígono oficial. Guatemala se carga en Commit 3.';
comment on column public.geo_countries.boundary is
  'geometry para point-in-polygon e intersección administrativa.';

create table if not exists public.geo_departments (
  id            uuid primary key default gen_random_uuid(),
  country_code  text not null references public.geo_countries (code) on delete restrict,
  code          text not null,
  name          text not null,
  boundary      geometry(MultiPolygon, 4326),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint geo_departments_country_code_unique unique (country_code, code)
);

comment on table public.geo_departments is
  'Departamentos/estados. Polígonos oficiales se cargan en Commit 3.';

create table if not exists public.geo_municipalities (
  id              uuid primary key default gen_random_uuid(),
  department_id   uuid not null references public.geo_departments (id) on delete restrict,
  code            text not null,
  name            text not null,
  boundary        geometry(MultiPolygon, 4326),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint geo_municipalities_department_code_unique unique (department_id, code)
);

comment on table public.geo_municipalities is
  'Municipios. Polígonos oficiales se cargan en Commit 3.';

create index if not exists geo_countries_boundary_gix
  on public.geo_countries using gist (boundary);

create index if not exists geo_departments_boundary_gix
  on public.geo_departments using gist (boundary);

create index if not exists geo_municipalities_boundary_gix
  on public.geo_municipalities using gist (boundary);

-- País base (sin polígono hasta Commit 3)
insert into public.geo_countries (code, name)
values ('GT', 'Guatemala')
on conflict (code) do nothing;

-- Triggers updated_at — capas geo
create trigger geo_countries_set_updated_at
  before update on public.geo_countries
  for each row execute function public.set_updated_at();

create trigger geo_departments_set_updated_at
  before update on public.geo_departments
  for each row execute function public.set_updated_at();

create trigger geo_municipalities_set_updated_at
  before update on public.geo_municipalities
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. Auditoría de ingesta FIRMS (backend-only)
-- -----------------------------------------------------------------------------
create table if not exists public.fire_ingestion_runs (
  id                   uuid primary key default gen_random_uuid(),
  started_at           timestamptz not null default now(),
  completed_at         timestamptz,
  status               text not null default 'running'
                       check (status in ('running', 'success', 'partial', 'failed')),
  source               text not null default 'nasa-firms',
  sources_queried      text[] not null default '{}',
  day_range            smallint not null default 2
                       check (day_range between 1 and 5),
  sanitized_request    jsonb not null default '[]',
  http_status          jsonb not null default '{}',
  rows_received        integer not null default 0,
  rows_valid           integer not null default 0,
  rows_rejected        integer not null default 0,
  rows_inserted        integer not null default 0,
  rows_updated         integer not null default 0,
  rows_duplicated      integer not null default 0,
  rows_outside_country integer not null default 0,
  duration_ms          integer,
  error_message        text,
  metadata             jsonb not null default '{}',
  created_at           timestamptz not null default now()
);

comment on table public.fire_ingestion_runs is
  'Auditoría de ingesta. Solo accesible vía service role (backend).';

create index if not exists fire_ingestion_runs_started_at_idx
  on public.fire_ingestion_runs (started_at desc);

create index if not exists fire_ingestion_runs_status_idx
  on public.fire_ingestion_runs (status, started_at desc);

-- -----------------------------------------------------------------------------
-- 3. Detecciones satelitales individuales (backend-only)
-- -----------------------------------------------------------------------------
create table if not exists public.fire_detections (
  id                      uuid primary key default gen_random_uuid(),
  dedup_key               text not null,
  ingestion_run_id        uuid references public.fire_ingestion_runs (id) on delete set null,

  source_product          text not null,
  satellite               text,
  instrument              text,
  data_version            text,

  latitude                numeric(9, 6) not null,
  longitude               numeric(9, 6) not null,
  location                geography(Point, 4326) not null,

  acquired_at_utc         timestamptz not null,
  first_seen_at           timestamptz not null default now(),
  last_seen_at            timestamptz not null default now(),
  ingested_at             timestamptz not null default now(),

  confidence_raw          text,
  confidence_normalized   text
                          check (confidence_normalized in ('baja', 'media', 'alta')),
  detection_label         text not null default 'Foco de calor detectado',
  frp_mw                  numeric(12, 4),
  brightness              numeric(12, 4),
  daynight                text,

  country_code            text references public.geo_countries (code) on delete restrict,
  is_inside_guatemala     boolean,
  department_id           uuid references public.geo_departments (id) on delete set null,
  municipality_id         uuid references public.geo_municipalities (id) on delete set null,

  geography_method        text not null default 'unresolved'
                          check (geography_method in (
                            'postgis_polygon',
                            'bbox_estimate',
                            'unresolved'
                          )),
  geography_confidence    text
                          check (geography_confidence in ('high', 'medium', 'low')),

  raw_payload             jsonb not null default '{}',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint fire_detections_dedup_key_unique unique (dedup_key),
  constraint fire_detections_lat_range check (latitude between -90 and 90),
  constraint fire_detections_lng_range check (longitude between -180 and 180),
  constraint fire_detections_frp_nonnegative
    check (frp_mw is null or frp_mw >= 0),
  constraint fire_detections_daynight_valid
    check (daynight is null or daynight in ('D', 'N')),
  constraint fire_detections_time_valid
    check (last_seen_at >= first_seen_at)
);

comment on table public.fire_detections is
  'Observación satelital FIRMS. Backend-only. No equivale a incendio confirmado.';
comment on column public.fire_detections.country_code is
  'NULL hasta resolver por point-in-polygon. No asumir GT por defecto.';
comment on column public.fire_detections.is_inside_guatemala is
  'false = fuera de GT; se conserva para auditoría, excluido de vistas nacionales.';

create index if not exists fire_detections_datetime_idx
  on public.fire_detections (acquired_at_utc desc);

create index if not exists fire_detections_source_idx
  on public.fire_detections (source_product);

create index if not exists fire_detections_location_gix
  on public.fire_detections using gist (location);

create index if not exists fire_detections_guatemala_idx
  on public.fire_detections (is_inside_guatemala, acquired_at_utc desc)
  where is_inside_guatemala = true;

create index if not exists fire_detections_ingestion_run_idx
  on public.fire_detections (ingestion_run_id);

create trigger fire_detections_sync_location_trg
  before insert or update of latitude, longitude
  on public.fire_detections
  for each row
  execute function public.fire_detections_sync_location();

create trigger fire_detections_set_updated_at
  before update on public.fire_detections
  for each row
  execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Eventos térmicos agrupados (backend-only; lógica en Commit 4)
-- -----------------------------------------------------------------------------
create table if not exists public.fire_events (
  id                    uuid primary key default gen_random_uuid(),
  status                text not null default 'new'
                        check (status in ('new', 'active', 'monitoring', 'closed')),
  validation_status     text not null default 'no_validado'
                        check (validation_status in ('no_validado', 'probable', 'confirmado')),
  risk_level            text not null default 'informativo'
                        check (risk_level in (
                          'informativo', 'observacion', 'atencion', 'alto', 'critico'
                        )),
  priority_score        numeric(5, 2) not null default 0,

  centroid_lat          numeric(9, 6),
  centroid_lng          numeric(9, 6),
  centroid              geography(Point, 4326),

  event_geometry        geometry(MultiPolygon, 4326),
  geometry_method       text,
  estimated_area_ha     numeric(14, 4),

  first_detected_at     timestamptz not null,
  last_detected_at      timestamptz not null,
  persistence_hours     numeric(10, 2),
  detection_count       integer not null default 0,
  satellite_count       integer not null default 0,
  source_products       text[] not null default '{}',
  max_frp_mw            numeric(12, 4),

  country_code          text references public.geo_countries (code) on delete restrict,
  department_id         uuid references public.geo_departments (id) on delete set null,
  municipality_id       uuid references public.geo_municipalities (id) on delete set null,

  environmental_context text,
  metadata              jsonb not null default '{}',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint fire_events_priority_range
    check (priority_score between 0 and 100),
  constraint fire_events_detection_count_nonnegative
    check (detection_count >= 0),
  constraint fire_events_satellite_count_nonnegative
    check (satellite_count >= 0),
  constraint fire_events_frp_nonnegative
    check (max_frp_mw is null or max_frp_mw >= 0),
  constraint fire_events_time_order
    check (last_detected_at >= first_detected_at),
  constraint fire_events_estimated_area_nonnegative
    check (estimated_area_ha is null or estimated_area_ha >= 0)
);

comment on table public.fire_events is
  'Evento térmico agrupado. Backend-only hasta vistas/endpoints seguros.';
comment on column public.fire_events.event_geometry is
  'Geometría estimada (envolvente/buffer). No es área quemada confirmada.';
comment on column public.fire_events.estimated_area_ha is
  'Área estimada del evento. No medición directa FIRMS de área quemada.';

create index if not exists fire_events_status_idx
  on public.fire_events (status, last_detected_at desc);

create index if not exists fire_events_centroid_gix
  on public.fire_events using gist (centroid);

create index if not exists fire_events_geometry_gix
  on public.fire_events using gist (event_geometry);

create index if not exists fire_events_department_idx
  on public.fire_events (department_id)
  where department_id is not null;

create trigger fire_events_set_updated_at
  before update on public.fire_events
  for each row
  execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. Relación evento ↔ detección (backend-only)
-- -----------------------------------------------------------------------------
create table if not exists public.fire_event_detections (
  event_id      uuid not null references public.fire_events (id) on delete cascade,
  detection_id  uuid not null references public.fire_detections (id) on delete cascade,
  linked_at     timestamptz not null default now(),
  primary key (event_id, detection_id)
);

comment on table public.fire_event_detections is
  'N:M evidencia multi-satélite. Backend-only.';

create index if not exists fire_event_detections_detection_idx
  on public.fire_event_detections (detection_id);

-- -----------------------------------------------------------------------------
-- 6. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.geo_countries          enable row level security;
alter table public.geo_departments        enable row level security;
alter table public.geo_municipalities     enable row level security;
alter table public.fire_ingestion_runs    enable row level security;
alter table public.fire_detections        enable row level security;
alter table public.fire_events            enable row level security;
alter table public.fire_event_detections  enable row level security;

-- Capas geo: lectura pública (sin geometría sensible adicional)
create policy "geo_countries_read"
  on public.geo_countries for select
  to anon, authenticated
  using (true);

create policy "geo_departments_read"
  on public.geo_departments for select
  to anon, authenticated
  using (true);

create policy "geo_municipalities_read"
  on public.geo_municipalities for select
  to anon, authenticated
  using (true);

-- fire_detections: SIN policy pública → backend-only (service role)
-- fire_events: SIN policy pública → backend-only
-- fire_event_detections: SIN policy pública → backend-only
-- fire_ingestion_runs: SIN policy pública → backend-only

-- -----------------------------------------------------------------------------
-- 7. Vista nacional segura (única superficie pública para detecciones)
-- -----------------------------------------------------------------------------
-- NOTA: security_invoker = true requiere que el rol invocador pueda leer la
-- tabla base (expone todas las columnas vía RLS). Como fire_detections es
-- backend-only (REVOKE + sin policies), la vista corre como owner (postgres)
-- y proyecta únicamente columnas seguras. El frontend nunca consulta la tabla.
create or replace view public.fire_detections_national
as
select
  id,
  latitude,
  longitude,
  location,
  acquired_at_utc,
  (acquired_at_utc at time zone 'America/Guatemala') as acquired_at_guatemala,
  source_product,
  satellite,
  instrument,
  confidence_normalized,
  detection_label,
  frp_mw,
  brightness,
  daynight,
  department_id,
  municipality_id,
  first_seen_at,
  last_seen_at
from public.fire_detections
where is_inside_guatemala = true;

comment on view public.fire_detections_national is
  'Detecciones nacionales con columnas seguras. Sin raw_payload ni campos internos.';

grant select on public.fire_detections_national to anon, authenticated;
grant select on public.geo_countries to anon, authenticated;
grant select on public.geo_departments to anon, authenticated;
grant select on public.geo_municipalities to anon, authenticated;

-- Revocar acceso directo a tablas backend-only desde roles públicos
revoke all on public.fire_detections from anon, authenticated;
revoke all on public.fire_events from anon, authenticated;
revoke all on public.fire_event_detections from anon, authenticated;
revoke all on public.fire_ingestion_runs from anon, authenticated;

-- =============================================================================
-- ROLLBACK (ejecutar manualmente si es necesario revertir Commit 1)
-- =============================================================================
-- revoke all on public.fire_detections_national from anon, authenticated;
-- drop view if exists public.fire_detections_national;
-- drop table if exists public.fire_event_detections cascade;
-- drop table if exists public.fire_events cascade;
-- drop trigger if exists fire_detections_sync_location_trg on public.fire_detections;
-- drop trigger if exists fire_detections_set_updated_at on public.fire_detections;
-- drop trigger if exists fire_events_set_updated_at on public.fire_events;
-- drop trigger if exists geo_countries_set_updated_at on public.geo_countries;
-- drop trigger if exists geo_departments_set_updated_at on public.geo_departments;
-- drop trigger if exists geo_municipalities_set_updated_at on public.geo_municipalities;
-- drop function if exists public.fire_detections_sync_location();
-- drop function if exists public.set_updated_at();
-- drop table if exists public.fire_detections cascade;
-- drop table if exists public.fire_ingestion_runs cascade;
-- drop table if exists public.geo_municipalities cascade;
-- drop table if exists public.geo_departments cascade;
-- drop table if exists public.geo_countries cascade;
