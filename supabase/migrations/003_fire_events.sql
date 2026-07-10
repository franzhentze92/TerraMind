-- =============================================================================
-- TerraMind — Commit 4: Eventos térmicos agrupados
-- =============================================================================
-- Rollback documentado en docs/FIRE-EVENTS-ROLLBACK.md
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Unicidad: una detección → un evento máximo
-- -----------------------------------------------------------------------------
alter table public.fire_event_detections
  drop constraint if exists fire_event_detections_detection_unique;

alter table public.fire_event_detections
  add constraint fire_event_detections_detection_unique unique (detection_id);

-- -----------------------------------------------------------------------------
-- Sincronizar centroid desde lat/lng
-- -----------------------------------------------------------------------------
create or replace function public.fire_events_sync_centroid()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if new.centroid_lat is not null and new.centroid_lng is not null then
    new.centroid := extensions.st_setsrid(
      extensions.st_makepoint(new.centroid_lng::float8, new.centroid_lat::float8),
      4326
    )::geography;
  end if;
  return new;
end;
$$;

drop trigger if exists fire_events_sync_centroid_trg on public.fire_events;

create trigger fire_events_sync_centroid_trg
  before insert or update of centroid_lat, centroid_lng
  on public.fire_events
  for each row
  execute function public.fire_events_sync_centroid();

-- -----------------------------------------------------------------------------
-- Pares de detecciones vecinas (PostGIS)
-- -----------------------------------------------------------------------------
create or replace function public.fire_detection_neighbor_pairs(
  p_detection_ids uuid[],
  p_distance_m double precision default 1500,
  p_hours double precision default 12
)
returns table(id_a uuid, id_b uuid)
language sql
stable
set search_path = public, extensions
as $$
  select
    least(a.id, b.id) as id_a,
    greatest(a.id, b.id) as id_b
  from public.fire_detections a
  join public.fire_detections b on a.id < b.id
  where a.id = any(p_detection_ids)
    and b.id = any(p_detection_ids)
    and extensions.st_dwithin(a.location, b.location, p_distance_m)
    and abs(extract(epoch from (a.acquired_at_utc - b.acquired_at_utc))) <= p_hours * 3600;
$$;

revoke all on function public.fire_detection_neighbor_pairs(uuid[], double precision, double precision) from public;
grant execute on function public.fire_detection_neighbor_pairs(uuid[], double precision, double precision) to service_role;

-- -----------------------------------------------------------------------------
-- Geometría estimada del evento
-- -----------------------------------------------------------------------------
create or replace function public.compute_event_geometry(
  p_detection_ids uuid[],
  p_buffer_m double precision default 375
)
returns jsonb
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_count integer;
  v_geom geometry;
  v_result geometry(MultiPolygon, 4326);
  v_centroid geometry;
  v_area_ha double precision;
  v_method text;
begin
  select count(*)::int into v_count
  from public.fire_detections
  where id = any(p_detection_ids);

  if v_count = 0 then
    raise exception 'Sin detecciones para geometría de evento';
  end if;

  if v_count = 1 then
    select extensions.st_buffer(location, p_buffer_m)::geometry
    into v_geom
    from public.fire_detections
    where id = p_detection_ids[1];
    v_method := 'single_detection_buffer';
  else
    select extensions.st_buffer(
      extensions.st_convexhull(extensions.st_collect(location::geometry))::geography,
      p_buffer_m
    )::geometry
    into v_geom
    from public.fire_detections
    where id = any(p_detection_ids);
    v_method := 'convex_hull_buffer';
  end if;

  v_geom := extensions.st_makevalid(extensions.st_force2d(v_geom));

  if extensions.st_geometrytype(v_geom) = 'ST_Polygon' then
    v_result := extensions.st_multi(v_geom)::geometry(MultiPolygon, 4326);
  elsif extensions.st_geometrytype(v_geom) in ('ST_MultiPolygon', 'ST_GeometryCollection') then
    v_result := extensions.st_multi(extensions.st_collectionextract(v_geom, 3))::geometry(MultiPolygon, 4326);
  else
    raise exception 'Geometría de evento no poligonal: %', extensions.st_geometrytype(v_geom);
  end if;

  if extensions.st_isempty(v_result) or not extensions.st_isvalid(v_result) then
    raise exception 'Geometría de evento inválida o vacía';
  end if;

  if extensions.st_srid(v_result) <> 4326 then
    v_result := extensions.st_setsrid(v_result, 4326)::geometry(MultiPolygon, 4326);
  end if;

  select extensions.st_centroid(extensions.st_collect(location::geometry))
  into v_centroid
  from public.fire_detections
  where id = any(p_detection_ids);

  v_area_ha := extensions.st_area(v_result::extensions.geography) / 10000.0;

  return jsonb_build_object(
    'geometry', extensions.st_asgeojson(v_result)::jsonb,
    'geometry_method', v_method,
    'estimated_area_ha', round(v_area_ha::numeric, 4),
    'centroid_lat', extensions.st_y(v_centroid),
    'centroid_lng', extensions.st_x(v_centroid),
    'area_is_diagnostic', true,
    'not_burned_area', true
  );
end;
$$;

revoke all on function public.compute_event_geometry(uuid[], double precision) from public;
revoke all on function public.compute_event_geometry(uuid[], double precision) from anon;
revoke all on function public.compute_event_geometry(uuid[], double precision) from authenticated;
grant execute on function public.compute_event_geometry(uuid[], double precision) to service_role;

comment on function public.compute_event_geometry is
  'Geometría diagnóstica del cluster. No es área quemada confirmada.';
