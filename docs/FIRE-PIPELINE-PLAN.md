# Plan — Pipeline FIRMS productivo

**Estado actual:** FIRMS devuelve ~27 detecciones (3 VIIRS, DAY_RANGE=2).  
**Persistencia actual:** JSON local (`data/terramind-store.json`).  
**Supabase:** No configurado en TerraMind (requiere proyecto dedicado).

---

## Arquitectura objetivo

```
NASA FIRMS (3× VIIRS)
    ↓
Data Connector          src/pipeline/connectors/firms.*
    ↓
Ingesta + normalización src/pipeline/engines/fire/ingest.engine.ts
    ↓
Persistencia (upsert)   fire_detections + fire_ingestion_runs
    ↓
Filtro territorial      src/pipeline/engines/fire/geography.engine.ts
    ↓
Agrupación espacio-temp src/pipeline/engines/fire/events.engine.ts
    ↓
Clasificación riesgo    src/pipeline/engines/fire/risk.engine.ts  [Fase 2]
    ↓
Capas territoriales     PostGIS + tablas de referencia            [Fase 2]
    ↓
Hallazgos automáticos   src/pipeline/engines/hallazgo.engine.ts   [Fase 3]
    ↓
API                     server/routes/fires.ts
    ↓
UI                      modules/fires/ + tarjeta en Situación Nacional
    ↓
Copilot                 NO hasta Fase 4
```

---

## Esquema de tablas

### `fire_ingestion_runs`
Auditoría por ejecución del cron.

| Columna | Tipo |
|---------|------|
| id | uuid PK |
| started_at | timestamptz |
| completed_at | timestamptz |
| status | text (success, partial, failed) |
| sources_queried | text[] |
| http_statuses | jsonb |
| rows_received | int |
| rows_valid | int |
| rows_rejected | int |
| rows_duplicated | int |
| rows_outside_country | int |
| duration_ms | int |
| error_message | text (sanitizado, sin MAP_KEY) |
| sanitized_urls | jsonb |

### `fire_detections`
Una fila por observación satelital única.

| Columna | Tipo |
|---------|------|
| id | uuid PK |
| dedup_key | text UNIQUE |
| source_product | text (VIIRS_SNPP_NRT, etc.) |
| latitude | numeric(9,6) |
| longitude | numeric(9,6) |
| geom | geography(POINT) — PostGIS |
| acq_datetime_utc | timestamptz |
| acq_datetime_local | timestamptz |
| satellite | text |
| instrument | text |
| confidence_raw | text |
| confidence_normalized | text (baja, media, alta) |
| detection_label | text DEFAULT 'Foco de calor detectado' |
| frp_mw | numeric |
| brightness | numeric |
| daynight | text |
| data_version | text |
| country_code | text DEFAULT 'GT' |
| inside_guatemala | boolean |
| department_id | text |
| department_name | text |
| municipality_id | text |
| first_seen_at | timestamptz |
| last_seen_at | timestamptz |
| ingested_at | timestamptz |
| ingestion_run_id | uuid FK |
| raw_payload | jsonb |

**Unique:** `(source_product, latitude, longitude, acq_datetime_utc)`

### `fire_events`
Eventos agrupados (1.5 km, 12 h).

| Columna | Tipo |
|---------|------|
| id | uuid PK |
| status | text (new, active, monitoring, closed) |
| centroid_lat | numeric |
| centroid_lng | numeric |
| geom | geography(POINT) |
| first_detected_at | timestamptz |
| last_detected_at | timestamptz |
| detection_count | int |
| satellite_count | int |
| source_products | text[] |
| max_frp_mw | numeric |
| persistence_hours | numeric |
| department_id | text |
| department_name | text |
| risk_level | text (informativo, observacion, atencion, alto, critico) |
| validation_status | text (no_validado, probable, confirmado) |
| priority_score | numeric |
| created_at | timestamptz |
| updated_at | timestamptz |

### `fire_event_detections`
Relación N:M — no eliminar detecciones multi-satélite.

| Columna | Tipo |
|---------|------|
| event_id | uuid FK |
| detection_id | uuid FK |
| PRIMARY KEY (event_id, detection_id) |

### Tablas de referencia (Fase 2)
- `guatemala_boundary` — polígono nacional
- `guatemala_departments` — multipolígonos departamentales
- `guatemala_municipalities` — municipios
- `protected_areas` — áreas protegidas (preparado, vacío)

---

## Archivos a crear / modificar

| Acción | Ruta |
|--------|------|
| CREAR | `supabase/migrations/001_fire_schema.sql` |
| CREAR | `src/pipeline/engines/fire/ingest.engine.ts` |
| CREAR | `src/pipeline/engines/fire/geography.engine.ts` |
| CREAR | `src/pipeline/engines/fire/events.engine.ts` |
| CREAR | `src/pipeline/engines/fire/confidence.adapter.ts` |
| CREAR | `src/pipeline/stores/fire.store.ts` (interface) |
| CREAR | `src/pipeline/stores/supabase.fire.store.ts` |
| CREAR | `src/pipeline/stores/sqlite.fire.store.ts` (dev sin Supabase) |
| CREAR | `server/routes/fires.ts` |
| MODIFICAR | `src/pipeline/orchestrator.ts` — delegar a fire pipeline |
| MODIFICAR | `server/index.ts` — montar rutas /api/environment/fires/* |
| MODIFICAR | `src/pipeline/scheduler.ts` — 30 min |
| CREAR | `src/modules/fires/` — página + componentes |
| MODIFICAR | `src/modules/national-center/` — tarjeta resumen |
| MODIFICAR | `src/app/router.tsx` — ruta /incendios |
| MODIFICAR | `.env.example` — SUPABASE_URL, SUPABASE_SERVICE_KEY |

**No tocar:** `modules/copilot/` en esta fase.

---

## Flujo de datos (una ejecución)

1. `runFireIngestion()` inicia `fire_ingestion_runs`
2. `fetchFirmsDetections()` — 3 fuentes VIIRS
3. Por cada fila: normalizar confianza, UTC + America/Guatemala
4. `upsert` en `fire_detections` (dedup_key)
5. `filterInsideGuatemala()` — bbox departamentos v1; PostGIS v2
6. Asignar `department_id` via point-in-bbox
7. `groupIntoEvents()` — 1.5 km / 12 h, actualizar `fire_events`
8. Vincular en `fire_event_detections`
9. Calcular `risk_level` básico (FRP + persistencia + confianza)
10. Cerrar `fire_ingestion_runs` con métricas
11. API sirve summary/events a UI

---

## Dependencias nuevas

| Paquete | Uso |
|---------|-----|
| `@supabase/supabase-js` | Persistencia producción |
| `better-sqlite3` | Dev local sin Supabase |
| `leaflet` + `react-leaflet` | Mapa eventos |
| `@turf/turf` | Point-in-polygon (v1 sin PostGIS) |

---

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Supabase MCP apunta a otro proyecto | Proyecto TerraMind dedicado + env vars |
| Sin polígono oficial GT | Bboxes departamentales v1; GeoJSON INE después |
| Duplicado espacial ≠ duplicado técnico | Unique en detección; eventos agrupan después |
| "Incendio confirmado" prematuro | `detection_label` = foco de calor; validación manual |
| Mapa sin PostGIS en Supabase free | Turf.js en servidor; PostGIS cuando esté habilitado |
| 3 fuentes × cron 30 min = 6 req/30min | Muy por debajo del límite 5000/10min |

---

## Plan de commits

1. `feat(db): fire_detections + fire_ingestion_runs schema`
2. `feat(fire): ingest engine with upsert and run audit`
3. `feat(fire): guatemala filter + department assignment`
4. `feat(fire): event grouping 1.5km/12h`
5. `feat(api): /environment/fires endpoints`
6. `feat(ui): fires summary card + map page`
7. `chore: scheduler 30min, remove file-store for fire data`

---

## Prioridad inmediata (este sprint)

✅ Guardar correctamente  
✅ Ubicar dentro de Guatemala  
✅ Agrupar en eventos  
✅ Mostrar en mapa + tabla  

❌ Copilot  
❌ Áreas protegidas  
❌ Clima  
❌ Hallazgos automáticos completos  
