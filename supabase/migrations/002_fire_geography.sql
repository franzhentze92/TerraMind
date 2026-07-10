-- =============================================================================
-- TerraMind — Commit 3A: Geografía FIRMS (HDX COD-AB + clasificación PostGIS)
-- =============================================================================
-- Rollback documentado en docs/GEO-ROLLBACK.md (no ejecutar en flujo normal).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Columnas de trazabilidad de fuente
-- -----------------------------------------------------------------------------
alter table public.geo_countries
  add column if not exists source_pcode text;

alter table public.geo_departments
  add column if not exists source_pcode text;

comment on column public.geo_countries.source_pcode is
  'P-code del dataset fuente (ej. GT en HDX COD-AB).';
comment on column public.geo_departments.source_pcode is
  'P-code ADM1 del dataset fuente (ej. GT16 en HDX COD-AB).';

-- -----------------------------------------------------------------------------
-- Normalización geométrica → MultiPolygon 4326
-- -----------------------------------------------------------------------------
create or replace function public.normalize_boundary(p_geom geometry)
returns geometry(MultiPolygon, 4326)
language plpgsql
immutable
set search_path = public, extensions
as $$
declare
  g geometry;
  gt text;
begin
  if p_geom is null then
    raise exception 'Geometría nula';
  end if;

  g := extensions.st_setsrid(
    extensions.st_makevalid(extensions.st_force2d(p_geom)),
    4326
  );

  gt := extensions.st_geometrytype(g);

  if gt = 'ST_Polygon' then
    g := extensions.st_multi(g);
  elsif gt = 'ST_MultiPolygon' then
    null;
  elsif gt in ('ST_GeometryCollection', 'ST_MultiSurface') then
    g := extensions.st_multi(extensions.st_collectionextract(g, 3));
  else
    raise exception 'Geometría no poligonal: %', gt;
  end if;

  if extensions.st_isempty(g) or not extensions.st_isvalid(g) then
    raise exception 'Geometría inválida o vacía tras normalización';
  end if;

  return g::geometry(MultiPolygon, 4326);
end;
$$;

create or replace function public.normalize_boundary_geojson(p_geojson jsonb)
returns geometry(MultiPolygon, 4326)
language plpgsql
immutable
set search_path = public, extensions
as $$
begin
  return public.normalize_boundary(
    extensions.st_setsrid(
      extensions.st_geomfromgeojson(p_geojson::text),
      4326
    )
  );
end;
$$;

revoke all on function public.normalize_boundary(geometry) from public;
revoke all on function public.normalize_boundary_geojson(jsonb) from public;
grant execute on function public.normalize_boundary_geojson(jsonb) to service_role;

-- -----------------------------------------------------------------------------
-- Upsert de límites desde GeoJSON (importación backend)
-- -----------------------------------------------------------------------------
create or replace function public.geo_upsert_country_boundary(
  p_code text,
  p_name text,
  p_source_pcode text,
  p_geojson jsonb
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_boundary geometry(MultiPolygon, 4326);
begin
  v_boundary := public.normalize_boundary_geojson(p_geojson);

  insert into public.geo_countries (code, name, source_pcode, boundary)
  values (p_code, p_name, p_source_pcode, v_boundary)
  on conflict (code) do update
    set name = excluded.name,
        source_pcode = excluded.source_pcode,
        boundary = excluded.boundary,
        updated_at = now();
end;
$$;

create or replace function public.geo_upsert_department_boundary(
  p_country_code text,
  p_code text,
  p_name text,
  p_source_pcode text,
  p_geojson jsonb
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_boundary geometry(MultiPolygon, 4326);
begin
  v_boundary := public.normalize_boundary_geojson(p_geojson);

  insert into public.geo_departments (country_code, code, name, source_pcode, boundary)
  values (p_country_code, p_code, p_name, p_source_pcode, v_boundary)
  on conflict (country_code, code) do update
    set name = excluded.name,
        source_pcode = excluded.source_pcode,
        boundary = excluded.boundary,
        updated_at = now();
end;
$$;

revoke all on function public.geo_upsert_country_boundary(text, text, text, jsonb) from public;
revoke all on function public.geo_upsert_country_boundary(text, text, text, jsonb) from anon;
revoke all on function public.geo_upsert_country_boundary(text, text, text, jsonb) from authenticated;
grant execute on function public.geo_upsert_country_boundary(text, text, text, jsonb) to service_role;

revoke all on function public.geo_upsert_department_boundary(text, text, text, text, jsonb) from public;
revoke all on function public.geo_upsert_department_boundary(text, text, text, text, jsonb) from anon;
revoke all on function public.geo_upsert_department_boundary(text, text, text, text, jsonb) from authenticated;
grant execute on function public.geo_upsert_department_boundary(text, text, text, text, jsonb) to service_role;

-- -----------------------------------------------------------------------------
-- Validación post-importación (controles geométricos)
-- -----------------------------------------------------------------------------
create or replace function public.geo_validate_guatemala_import()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_country_area double precision;
  v_union_area double precision;
  v_sym_diff_area double precision;
  v_sym_diff_pct double precision;
  v_overlap_pairs integer := 0;
  v_invalid integer := 0;
  v_empty integer := 0;
  v_wrong_srid integer := 0;
  v_dept_count integer := 0;
  v_country_has_boundary boolean := false;
  v_country_geom geometry;
  v_union_geom geometry;
begin
  select boundary is not null, boundary
  into v_country_has_boundary, v_country_geom
  from public.geo_countries where code = 'GT';

  select count(*)::int into v_dept_count
  from public.geo_departments where country_code = 'GT';

  select count(*)::int into v_invalid
  from public.geo_departments
  where country_code = 'GT' and not extensions.st_isvalid(boundary);

  select count(*)::int into v_empty
  from public.geo_departments
  where country_code = 'GT' and extensions.st_isempty(boundary);

  select count(*)::int into v_wrong_srid
  from public.geo_departments
  where country_code = 'GT' and extensions.st_srid(boundary) <> 4326;

  if v_country_geom is not null then
    v_country_area := extensions.st_area(v_country_geom::extensions.geography) / 1e6;
  end if;

  select extensions.st_union(boundary) into v_union_geom
  from public.geo_departments where country_code = 'GT';

  if v_union_geom is not null then
    v_union_area := extensions.st_area(v_union_geom::extensions.geography) / 1e6;
  end if;

  if v_country_geom is not null and v_union_geom is not null and v_country_area > 0 then
    v_sym_diff_area := extensions.st_area(
      extensions.st_symdifference(v_country_geom, v_union_geom)::extensions.geography
    ) / 1e6;
    v_sym_diff_pct := (v_sym_diff_area / v_country_area) * 100.0;
  end if;

  select count(*)::int into v_overlap_pairs
  from public.geo_departments a
  join public.geo_departments b
    on a.country_code = 'GT' and b.country_code = 'GT' and a.id < b.id
  where extensions.st_overlaps(a.boundary, b.boundary)
    and extensions.st_area(
      extensions.st_intersection(a.boundary, b.boundary)::extensions.geography
    ) > 1000; -- > 0.001 km²

  return jsonb_build_object(
    'country_has_boundary', v_country_has_boundary,
    'department_count', v_dept_count,
    'invalid_geometries', v_invalid,
    'empty_geometries', v_empty,
    'wrong_srid_count', v_wrong_srid,
    'country_area_sqkm_approx', round(v_country_area::numeric, 2),
    'departments_union_area_sqkm_approx', round(v_union_area::numeric, 2),
    'symmetric_difference_sqkm_approx', round(coalesce(v_sym_diff_area, 0)::numeric, 4),
    'symmetric_difference_pct_approx', round(coalesce(v_sym_diff_pct, 0)::numeric, 4),
    'significant_overlap_pairs', v_overlap_pairs
  );
end;
$$;

revoke all on function public.geo_validate_guatemala_import() from public;
revoke all on function public.geo_validate_guatemala_import() from anon;
revoke all on function public.geo_validate_guatemala_import() from authenticated;
grant execute on function public.geo_validate_guatemala_import() to service_role;

-- -----------------------------------------------------------------------------
-- Clasificación geográfica por conjuntos (escalable)
-- -----------------------------------------------------------------------------
create or replace function public.classify_fire_detections_geography(
  p_limit  integer default 1000,
  p_force  boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_limit integer;
  v_start timestamptz := clock_timestamp();
  v_targets integer := 0;
  v_outside integer := 0;
  v_inside integer := 0;
  v_dept_assigned integer := 0;
  v_no_dept integer := 0;
  v_multi_dept integer := 0;
  v_boundary_matches integer := 0;
  v_unresolved integer := 0;
begin
  v_limit := least(greatest(coalesce(p_limit, 1000), 1), 10000);

  create temp table _geo_targets on commit drop as
  select fd.id
  from public.fire_detections fd
  where (
    p_force
    or fd.is_inside_guatemala is null
    or fd.geography_method = 'unresolved'
  )
  order by fd.acquired_at_utc desc
  limit v_limit;

  get diagnostics v_targets = row_count;

  if v_targets = 0 then
    return jsonb_build_object(
      'evaluated', 0,
      'forced', p_force,
      'reprocessed', 0,
      'inside_guatemala', 0,
      'outside_guatemala', 0,
      'departments_assigned', 0,
      'no_department_match', 0,
      'multiple_department_matches', 0,
      'boundary_matches', 0,
      'unresolved', 0,
      'errors', 0,
      'duration_ms', round(extract(epoch from (clock_timestamp() - v_start)) * 1000)
    );
  end if;

  -- Fuera de Guatemala
  with updated as (
    update public.fire_detections fd
    set
      is_inside_guatemala = false,
      country_code = null,
      department_id = null,
      municipality_id = null,
      geography_method = 'postgis_polygon',
      geography_confidence = 'high',
      updated_at = now()
    from public.geo_countries c, _geo_targets t
    where fd.id = t.id
      and c.code = 'GT'
      and c.boundary is not null
      and not extensions.st_covers(c.boundary, fd.location::geometry)
    returning fd.id
  )
  select count(*)::int into v_outside from updated;

  -- Dentro de Guatemala
  with updated as (
    update public.fire_detections fd
    set
      is_inside_guatemala = true,
      country_code = 'GT',
      department_id = null,
      municipality_id = null,
      geography_method = 'postgis_polygon',
      geography_confidence = 'high',
      updated_at = now()
    from public.geo_countries c, _geo_targets t
    where fd.id = t.id
      and c.code = 'GT'
      and c.boundary is not null
      and extensions.st_covers(c.boundary, fd.location::geometry)
    returning fd.id
  )
  select count(*)::int into v_inside from updated;

  -- Departamento: coincidencia única
  with inside_targets as (
    select t.id
    from _geo_targets t
    join public.fire_detections fd on fd.id = t.id
    where fd.is_inside_guatemala = true
  ),
  matches as (
    select
      it.id as detection_id,
      array_agg(gd.id order by gd.code) as department_ids,
      count(*)::int as match_count
    from inside_targets it
    join public.fire_detections fd on fd.id = it.id
    join public.geo_departments gd
      on gd.country_code = 'GT'
     and extensions.st_covers(gd.boundary, fd.location::geometry)
    group by it.id
  ),
  updated as (
    update public.fire_detections fd
    set
      department_id = m.department_ids[1],
      updated_at = now()
    from matches m
    where fd.id = m.detection_id
      and m.match_count = 1
    returning fd.id
  )
  select count(*)::int into v_dept_assigned from updated;

  -- Múltiples departamentos (no asignar)
  with inside_targets as (
    select t.id
    from _geo_targets t
    join public.fire_detections fd on fd.id = t.id
    where fd.is_inside_guatemala = true
  ),
  multi as (
    select it.id
    from inside_targets it
    join public.fire_detections fd on fd.id = it.id
    join public.geo_departments gd
      on gd.country_code = 'GT'
     and extensions.st_covers(gd.boundary, fd.location::geometry)
    group by it.id
    having count(*) > 1
  )
  select count(*)::int into v_multi_dept from multi;

  v_boundary_matches := v_multi_dept;

  -- Sin departamento (dentro pero 0 coincidencias)
  select count(*)::int into v_no_dept
  from _geo_targets t
  join public.fire_detections fd on fd.id = t.id
  where fd.is_inside_guatemala = true
    and fd.department_id is null
    and (
      select count(*)
      from public.geo_departments gd
      where gd.country_code = 'GT'
        and extensions.st_covers(gd.boundary, fd.location::geometry)
    ) = 0;

  -- Sin resolver (país sin polígono u otro fallo)
  select count(*)::int into v_unresolved
  from _geo_targets t
  join public.fire_detections fd on fd.id = t.id
  where fd.is_inside_guatemala is null;

  return jsonb_build_object(
    'evaluated', v_targets,
    'forced', p_force,
    'reprocessed', case when p_force then v_targets else 0 end,
    'inside_guatemala', v_inside,
    'outside_guatemala', v_outside,
    'departments_assigned', v_dept_assigned,
    'no_department_match', v_no_dept,
    'multiple_department_matches', v_multi_dept,
    'boundary_matches', v_boundary_matches,
    'unresolved', v_unresolved,
    'errors', 0,
    'duration_ms', round(extract(epoch from (clock_timestamp() - v_start)) * 1000)
  );
end;
$$;

revoke all on function public.classify_fire_detections_geography(integer, boolean) from public;
revoke all on function public.classify_fire_detections_geography(integer, boolean) from anon;
revoke all on function public.classify_fire_detections_geography(integer, boolean) from authenticated;
grant execute on function public.classify_fire_detections_geography(integer, boolean) to service_role;

comment on function public.classify_fire_detections_geography is
  'Clasifica detecciones FIRMS por polígono nacional/departamental. Solo service_role.';
