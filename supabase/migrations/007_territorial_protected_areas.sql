-- =============================================================================
-- TerraMind — Commit 7A.1: Capas territoriales + áreas protegidas SIGAP
-- =============================================================================
-- Rollback: docs/GEO-ROLLBACK.md (sección 7A.1)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Catálogo de capas territoriales
-- -----------------------------------------------------------------------------
create table if not exists public.territorial_layers (
  id uuid primary key default gen_random_uuid(),
  layer_code text not null unique,
  name text not null,
  category text not null,
  source_organization text not null,
  source_url text,
  license text,
  source_version text not null,
  source_date date,
  geometry_type text not null default 'MultiPolygon',
  srid integer not null default 4326,
  update_frequency text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Features territoriales
-- -----------------------------------------------------------------------------
create table if not exists public.territorial_features (
  id uuid primary key default gen_random_uuid(),
  layer_id uuid not null references public.territorial_layers(id) on delete cascade,
  source_feature_id text not null,
  logical_area_key text not null,
  name text,
  feature_type text,
  geometry geometry(MultiPolygon, 4326) not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint territorial_features_layer_source_unique
    unique (layer_id, source_feature_id),
  constraint territorial_features_geometry_valid
    check (extensions.st_isvalid(geometry) and not extensions.st_isempty(geometry)),
  constraint territorial_features_srid_4326
    check (extensions.st_srid(geometry) = 4326)
);

create index if not exists territorial_features_geometry_gix
  on public.territorial_features using gist (geometry);

create index if not exists territorial_features_layer_id_idx
  on public.territorial_features (layer_id);

create index if not exists territorial_features_logical_area_key_idx
  on public.territorial_features (logical_area_key);

-- -----------------------------------------------------------------------------
-- Contexto territorial del evento térmico
-- -----------------------------------------------------------------------------
create table if not exists public.fire_event_context (
  event_id uuid primary key
    references public.fire_events(id) on delete cascade,
  context_version text not null,
  inside_protected_area boolean,
  detections_inside_protected_area_count integer not null default 0,
  detection_ids_inside_protected_area uuid[] not null default '{}',
  protected_area_ids uuid[] not null default '{}',
  protected_area_names text[] not null default '{}',
  diagnostic_geometry_intersects_protected_area boolean,
  nearest_protected_area_id uuid
    references public.territorial_features(id) on delete set null,
  nearest_protected_area_name text,
  nearest_protected_area_distance_m numeric,
  protected_area_context_status text not null
    check (protected_area_context_status in (
      'complete', 'partial', 'unavailable', 'error'
    )),
  source_versions jsonb not null default '{}'::jsonb,
  context_completeness numeric,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fire_event_context_status_idx
  on public.fire_event_context (protected_area_context_status);

-- -----------------------------------------------------------------------------
-- RLS: backend-only (service_role)
-- -----------------------------------------------------------------------------
alter table public.territorial_layers enable row level security;
alter table public.territorial_features enable row level security;
alter table public.fire_event_context enable row level security;

revoke all on table public.territorial_layers from anon, authenticated;
revoke all on table public.territorial_features from anon, authenticated;
revoke all on table public.fire_event_context from anon, authenticated;

grant all on table public.territorial_layers to service_role;
grant all on table public.territorial_features to service_role;
grant all on table public.fire_event_context to service_role;

-- -----------------------------------------------------------------------------
-- Normalizar geometría territorial a MultiPolygon 4326 válido
-- -----------------------------------------------------------------------------
create or replace function public.territorial_normalize_geometry(
  p_geometry_geojson jsonb
)
returns geometry(MultiPolygon, 4326)
language sql
immutable
set search_path = public, extensions
as $$
  select extensions.st_multi(
    extensions.st_collectionextract(
      extensions.st_makevalid(
        extensions.st_force2d(
          extensions.st_setsrid(
            extensions.st_geomfromgeojson(p_geometry_geojson::text),
            4326
          )
        )
      ),
      3
    )
  )::geometry(MultiPolygon, 4326);
$$;

revoke all on function public.territorial_normalize_geometry(jsonb) from public;
grant execute on function public.territorial_normalize_geometry(jsonb) to service_role;

-- -----------------------------------------------------------------------------
-- Upsert de feature territorial
-- -----------------------------------------------------------------------------
create or replace function public.territorial_upsert_feature(
  p_layer_code text,
  p_source_feature_id text,
  p_logical_area_key text,
  p_name text,
  p_feature_type text,
  p_properties jsonb,
  p_geometry_geojson jsonb
)
returns uuid
language plpgsql
set search_path = public, extensions
as $$
declare
  v_layer_id uuid;
  v_geom geometry(MultiPolygon, 4326);
  v_id uuid;
begin
  select id into v_layer_id
  from public.territorial_layers
  where layer_code = p_layer_code and is_active = true;

  if v_layer_id is null then
    raise exception 'Capa territorial no encontrada: %', p_layer_code;
  end if;

  v_geom := public.territorial_normalize_geometry(p_geometry_geojson);

  if extensions.st_isempty(v_geom) or not extensions.st_isvalid(v_geom) then
    raise exception 'Geometría inválida o vacía tras normalización para %', p_source_feature_id;
  end if;

  insert into public.territorial_features (
    layer_id,
    source_feature_id,
    logical_area_key,
    name,
    feature_type,
    geometry,
    properties,
    updated_at
  )
  values (
    v_layer_id,
    p_source_feature_id,
    p_logical_area_key,
    p_name,
    p_feature_type,
    v_geom,
    coalesce(p_properties, '{}'::jsonb),
    now()
  )
  on conflict (layer_id, source_feature_id)
  do update set
    logical_area_key = excluded.logical_area_key,
    name = excluded.name,
    feature_type = excluded.feature_type,
    geometry = excluded.geometry,
    properties = excluded.properties,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.territorial_upsert_feature(text, text, text, text, text, jsonb, jsonb) from public;
grant execute on function public.territorial_upsert_feature(text, text, text, text, text, jsonb, jsonb) to service_role;

-- -----------------------------------------------------------------------------
-- Enriquecer contexto de áreas protegidas para un evento
-- -----------------------------------------------------------------------------
create or replace function public.fire_enrich_protected_area_context(
  p_event_id uuid,
  p_context_version text,
  p_source_versions jsonb
)
returns public.fire_event_context
language plpgsql
set search_path = public, extensions
as $$
declare
  v_layer_id uuid;
  v_feature_count integer;
  v_inside boolean := false;
  v_diag_intersect boolean := false;
  v_detection_ids uuid[] := '{}';
  v_inside_count integer := 0;
  v_area_ids uuid[] := '{}';
  v_area_names text[] := '{}';
  v_nearest_id uuid;
  v_nearest_name text;
  v_nearest_dist numeric;
  v_status text := 'complete';
  v_completeness numeric := 1;
  v_detection_total integer := 0;
  v_row public.fire_event_context;
begin
  select id into v_layer_id
  from public.territorial_layers
  where layer_code = 'gt_protected_areas' and is_active = true;

  if v_layer_id is null then
    insert into public.fire_event_context (
      event_id, context_version, protected_area_context_status,
      source_versions, context_completeness, generated_at, updated_at
    )
    values (
      p_event_id, p_context_version, 'unavailable',
      coalesce(p_source_versions, '{}'::jsonb), 0, now(), now()
    )
    on conflict (event_id) do update set
      context_version = excluded.context_version,
      protected_area_context_status = 'unavailable',
      source_versions = excluded.source_versions,
      context_completeness = 0,
      updated_at = now()
    returning * into v_row;
    return v_row;
  end if;

  select count(*)::int into v_feature_count
  from public.territorial_features
  where layer_id = v_layer_id;

  if v_feature_count = 0 then
    insert into public.fire_event_context (
      event_id, context_version, protected_area_context_status,
      source_versions, context_completeness, generated_at, updated_at
    )
    values (
      p_event_id, p_context_version, 'unavailable',
      coalesce(p_source_versions, '{}'::jsonb), 0, now(), now()
    )
    on conflict (event_id) do update set
      context_version = excluded.context_version,
      protected_area_context_status = 'unavailable',
      source_versions = excluded.source_versions,
      context_completeness = 0,
      updated_at = now()
    returning * into v_row;
    return v_row;
  end if;

  -- Detecciones reales del evento
  with event_detections as (
    select fd.id, fd.location
    from public.fire_event_detections fed
    join public.fire_detections fd on fd.id = fed.detection_id
    where fed.event_id = p_event_id
  ),
  inside_hits as (
    select distinct
      ed.id as detection_id,
      tf.id as feature_id,
      tf.name as feature_name
    from event_detections ed
    cross join public.territorial_features tf
    where tf.layer_id = v_layer_id
      and extensions.st_covers(tf.geometry, ed.location::geometry)
  )
  select
    coalesce((select array_agg(distinct detection_id) from inside_hits), '{}'),
    coalesce((select count(distinct detection_id)::int from inside_hits), 0),
    coalesce((select array_agg(distinct feature_id) from inside_hits), '{}'),
    coalesce((select array_agg(distinct feature_name) from inside_hits), '{}')
  into v_detection_ids, v_inside_count, v_area_ids, v_area_names;

  v_inside := v_inside_count > 0;

  -- Superposición del buffer diagnóstico (no equivale a inside)
  select exists (
    select 1
    from public.fire_events fe
    join public.territorial_features tf on tf.layer_id = v_layer_id
    where fe.id = p_event_id
      and fe.event_geometry is not null
      and extensions.st_intersects(fe.event_geometry, tf.geometry)
  ) into v_diag_intersect;

  -- Distancia mínima desde detecciones reales (fallback: centroide)
  select count(*)::int into v_detection_total
  from public.fire_event_detections
  where event_id = p_event_id;

  if v_detection_total > 0 then
    select sub.id, sub.name, sub.dist_m
    into v_nearest_id, v_nearest_name, v_nearest_dist
    from (
      select
        tf.id,
        tf.name,
        min(
          extensions.st_distance(
            fd.location,
            extensions.st_closestpoint(tf.geometry, fd.location::geometry)::geography
          )
        ) as dist_m
      from public.fire_event_detections fed
      join public.fire_detections fd on fd.id = fed.detection_id
      cross join public.territorial_features tf
      where fed.event_id = p_event_id
        and tf.layer_id = v_layer_id
      group by tf.id, tf.name
      order by min(
        extensions.st_distance(
          fd.location,
          extensions.st_closestpoint(tf.geometry, fd.location::geometry)::geography
        )
      ) asc nulls last
      limit 1
    ) sub;

    v_status := 'complete';
    v_completeness := 1;
  else
    select sub.id, sub.name, sub.dist_m
    into v_nearest_id, v_nearest_name, v_nearest_dist
    from (
      select
        tf.id,
        tf.name,
        extensions.st_distance(
          fe.centroid,
          extensions.st_closestpoint(tf.geometry, fe.centroid::geometry)::geography
        ) as dist_m
      from public.fire_events fe
      cross join public.territorial_features tf
      where fe.id = p_event_id
        and tf.layer_id = v_layer_id
        and fe.centroid is not null
      order by dist_m asc nulls last
      limit 1
    ) sub;

    v_status := 'partial';
    v_completeness := 0.5;
  end if;

  if v_inside then
    v_nearest_dist := 0;
  elsif v_nearest_dist is not null and v_nearest_dist < 0 then
    v_nearest_dist := 0;
  end if;

  insert into public.fire_event_context (
    event_id,
    context_version,
    inside_protected_area,
    detections_inside_protected_area_count,
    detection_ids_inside_protected_area,
    protected_area_ids,
    protected_area_names,
    diagnostic_geometry_intersects_protected_area,
    nearest_protected_area_id,
    nearest_protected_area_name,
    nearest_protected_area_distance_m,
    protected_area_context_status,
    source_versions,
    context_completeness,
    generated_at,
    updated_at
  )
  values (
    p_event_id,
    p_context_version,
    v_inside,
    coalesce(v_inside_count, 0),
    coalesce(v_detection_ids, '{}'),
    coalesce(v_area_ids, '{}'),
    coalesce(v_area_names, '{}'),
    coalesce(v_diag_intersect, false),
    v_nearest_id,
    v_nearest_name,
    v_nearest_dist,
    v_status,
    coalesce(p_source_versions, '{}'::jsonb),
    v_completeness,
    now(),
    now()
  )
  on conflict (event_id) do update set
    context_version = excluded.context_version,
    inside_protected_area = excluded.inside_protected_area,
    detections_inside_protected_area_count = excluded.detections_inside_protected_area_count,
    detection_ids_inside_protected_area = excluded.detection_ids_inside_protected_area,
    protected_area_ids = excluded.protected_area_ids,
    protected_area_names = excluded.protected_area_names,
    diagnostic_geometry_intersects_protected_area = excluded.diagnostic_geometry_intersects_protected_area,
    nearest_protected_area_id = excluded.nearest_protected_area_id,
    nearest_protected_area_name = excluded.nearest_protected_area_name,
    nearest_protected_area_distance_m = excluded.nearest_protected_area_distance_m,
    protected_area_context_status = excluded.protected_area_context_status,
    source_versions = excluded.source_versions,
    context_completeness = excluded.context_completeness,
    generated_at = now(),
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.fire_enrich_protected_area_context(uuid, text, jsonb) from public;
grant execute on function public.fire_enrich_protected_area_context(uuid, text, jsonb) to service_role;

-- -----------------------------------------------------------------------------
-- Seed capa gt_protected_areas (idempotente)
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
  metadata
)
values (
  'gt_protected_areas',
  'Áreas protegidas SIGAP — Guatemala',
  'protected_area',
  'CONAP — Dirección de Análisis Geoespacial',
  'https://conap.gob.gt/direccion-de-analisis-geoespacial/',
  'No declarada explícitamente',
  'SIGAP_08122025_IP',
  '2025-12-08',
  'MultiPolygon',
  4326,
  'manual',
  jsonb_build_object(
    'terms_status', 'requires_confirmation',
    'attribution', 'Límites geoespaciales del SIGAP — CONAP',
    'source_crs', 'ESRI:103598',
    'feature_count_expected', 406
  )
)
on conflict (layer_code) do update set
  name = excluded.name,
  source_organization = excluded.source_organization,
  source_url = excluded.source_url,
  license = excluded.license,
  source_version = excluded.source_version,
  source_date = excluded.source_date,
  metadata = excluded.metadata,
  updated_at = now();
