-- =============================================================================
-- TerraMind — Commit 4: Aplicación transaccional de clusters
-- =============================================================================

create or replace function public.fire_cluster_apply_batch(
  p_clusters jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_item jsonb;
  v_event_id uuid;
  v_absorbed uuid;
  v_det_id text;
  v_geom jsonb;
  v_created integer := 0;
  v_updated integer := 0;
  v_merged integer := 0;
  v_absorbed_count integer := 0;
  v_linked integer := 0;
  v_detection_ids uuid[];
begin
  if p_clusters is null or jsonb_array_length(p_clusters) = 0 then
    return jsonb_build_object(
      'events_created', 0,
      'events_updated', 0,
      'events_merged', 0,
      'events_absorbed', 0,
      'detections_linked', 0
    );
  end if;

  for v_item in select * from jsonb_array_elements(p_clusters)
  loop
    v_detection_ids := array(
      select value::uuid
      from jsonb_array_elements_text(v_item->'detection_ids')
    );

    if v_detection_ids is null or array_length(v_detection_ids, 1) is null then
      raise exception 'Cluster sin detection_ids';
    end if;

    select public.compute_event_geometry(v_detection_ids, 375) into v_geom;

    if (v_item->>'action') = 'merge' then
      v_event_id := (v_item->>'event_id')::uuid;

      for v_absorbed in
        select value::uuid
        from jsonb_array_elements_text(coalesce(v_item->'absorbed_event_ids', '[]'::jsonb))
      loop
        update public.fire_event_detections
        set event_id = v_event_id
        where event_id = v_absorbed
          and detection_id not in (
            select detection_id from public.fire_event_detections where event_id = v_event_id
          );

        delete from public.fire_event_detections where event_id = v_absorbed;
        delete from public.fire_events where id = v_absorbed;
        v_absorbed_count := v_absorbed_count + 1;
      end loop;

      v_merged := v_merged + 1;
    elsif (v_item->>'action') = 'update' then
      v_event_id := (v_item->>'event_id')::uuid;
      v_updated := v_updated + 1;
    else
      insert into public.fire_events (
        status,
        validation_status,
        risk_level,
        priority_score,
        centroid_lat,
        centroid_lng,
        event_geometry,
        geometry_method,
        estimated_area_ha,
        first_detected_at,
        last_detected_at,
        persistence_hours,
        detection_count,
        satellite_count,
        source_products,
        max_frp_mw,
        country_code,
        department_id,
        municipality_id,
        metadata
      ) values (
        coalesce(v_item->'event'->>'status', 'new'),
        v_item->'event'->>'validation_status',
        v_item->'event'->>'risk_level',
        (v_item->'event'->>'priority_score')::numeric,
        (v_geom->>'centroid_lat')::numeric,
        (v_geom->>'centroid_lng')::numeric,
        extensions.st_geomfromgeojson(v_geom->'geometry')::geometry(MultiPolygon, 4326),
        v_geom->>'geometry_method',
        (v_geom->>'estimated_area_ha')::numeric,
        (v_item->'event'->>'first_detected_at')::timestamptz,
        (v_item->'event'->>'last_detected_at')::timestamptz,
        (v_item->'event'->>'persistence_hours')::numeric,
        (v_item->'event'->>'detection_count')::integer,
        (v_item->'event'->>'satellite_count')::integer,
        array(select jsonb_array_elements_text(v_item->'event'->'source_products')),
        nullif(v_item->'event'->>'max_frp_mw', '')::numeric,
        'GT',
        nullif(v_item->'event'->>'department_id', '')::uuid,
        null,
        coalesce(v_item->'event'->'metadata', '{}'::jsonb)
      )
      returning id into v_event_id;

      v_created := v_created + 1;
    end if;

    -- Vincular detecciones nuevas
    foreach v_det_id in array v_detection_ids::text[]
    loop
      insert into public.fire_event_detections (event_id, detection_id)
      values (v_event_id, v_det_id::uuid)
      on conflict (detection_id) do nothing;
      v_linked := v_linked + 1;
    end loop;

    -- Actualizar agregados del evento (create/update/merge)
    update public.fire_events e
    set
      status = coalesce(v_item->'event'->>'status', e.status),
      validation_status = case
        when e.validation_status = 'confirmado' then e.validation_status
        else v_item->'event'->>'validation_status'
      end,
      risk_level = v_item->'event'->>'risk_level',
      priority_score = (v_item->'event'->>'priority_score')::numeric,
      centroid_lat = (v_geom->>'centroid_lat')::numeric,
      centroid_lng = (v_geom->>'centroid_lng')::numeric,
      event_geometry = extensions.st_geomfromgeojson(v_geom->'geometry')::geometry(MultiPolygon, 4326),
      geometry_method = v_geom->>'geometry_method',
      estimated_area_ha = (v_geom->>'estimated_area_ha')::numeric,
      first_detected_at = (v_item->'event'->>'first_detected_at')::timestamptz,
      last_detected_at = (v_item->'event'->>'last_detected_at')::timestamptz,
      persistence_hours = (v_item->'event'->>'persistence_hours')::numeric,
      detection_count = (
        select count(*)::int from public.fire_event_detections where event_id = v_event_id
      ),
      satellite_count = (v_item->'event'->>'satellite_count')::integer,
      source_products = array(select jsonb_array_elements_text(v_item->'event'->'source_products')),
      max_frp_mw = nullif(v_item->'event'->>'max_frp_mw', '')::numeric,
      department_id = nullif(v_item->'event'->>'department_id', '')::uuid,
      metadata = coalesce(v_item->'event'->'metadata', '{}'::jsonb),
      updated_at = now()
    where e.id = v_event_id;
  end loop;

  return jsonb_build_object(
    'events_created', v_created,
    'events_updated', v_updated,
    'events_merged', v_merged,
    'events_absorbed', v_absorbed_count,
    'detections_linked', v_linked
  );
end;
$$;

revoke all on function public.fire_cluster_apply_batch(jsonb) from public;
revoke all on function public.fire_cluster_apply_batch(jsonb) from anon;
revoke all on function public.fire_cluster_apply_batch(jsonb) from authenticated;
grant execute on function public.fire_cluster_apply_batch(jsonb) to service_role;

-- Actualizar estados temporales de eventos abiertos
create or replace function public.fire_events_refresh_temporal_status()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_count integer := 0;
begin
  update public.fire_events
  set status = case
    when status = 'new' then status
    when last_detected_at >= now() - interval '12 hours' then 'active'
    when last_detected_at >= now() - interval '24 hours' then 'monitoring'
    else 'closed'
  end,
  updated_at = now()
  where status in ('new', 'active', 'monitoring')
    and validation_status <> 'confirmado';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.fire_events_refresh_temporal_status() from public;
revoke all on function public.fire_events_refresh_temporal_status() from anon;
revoke all on function public.fire_events_refresh_temporal_status() from authenticated;
grant execute on function public.fire_events_refresh_temporal_status() to service_role;
