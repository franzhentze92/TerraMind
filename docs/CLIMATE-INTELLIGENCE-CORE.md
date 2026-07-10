# Climate Intelligence Core (7B.1)

Módulo climático reutilizable de TerraMind. **No está acoplado a incendios** ni modifica
`fire_event_context`, scheduler FIRMS, score ni UI de fuego.

## Rama de trabajo

```text
feature/climate-intelligence-core
worktree: ../terramind-climate
base: main @ b092e59 (rebased)
```

## Numeración de migraciones

| Archivo | Módulo |
|---------|--------|
| `008_climate_intelligence_core.sql` | Climate Core (este commit) |
| `009_land_cover_context.sql` | Land cover (agente separado; reservado) |

No usar `008` para land cover.

## Semántica espacial — puntos de referencia

Las 23 ubicaciones nacionales son **puntos de referencia**, no promedios espaciales:

| Tipo | Etiqueta |
|------|----------|
| País | `Punto de referencia nacional — centroide geográfico de Guatemala` |
| Departamento | `Punto de referencia departamental — centroide de {nombre}` |

Campos:

- `location_representation = point_reference`
- `display_name` — etiqueta humana correcta
- `spatial_disclaimer` en DTO API

> Este valor corresponde a un punto geográfico de referencia y no representa un
> promedio espacial del territorio.

Para clima nacional real en el futuro: estaciones, muestreo espacial, promedios
ponderados por área, máximos/mínimos departamentales — nunca un único centroide.

## Tipo de dato — modelado, no observado

Open-Meteo `current` es salida **modelada/interpolada**, no medición de estación.

- `observed_or_modelled = modelled`
- API: `condition_label = "Condición meteorológica modelada más reciente"`
- Columna DB `observed_at` almacena `model_time_utc` (UTC)

## Elevación

Open-Meteo resuelve elevación del modelo automáticamente si no se envía `elevation`.
Si `climate_locations.elevation_m` está registrado, se envía como parámetro `elevation`.

Se guarda y expone:

| Campo | Descripción |
|-------|-------------|
| `registered_elevation_m` | En `climate_locations.elevation_m` |
| `provider_elevation_m` | Respuesta Open-Meteo (`elevation`) |
| `elevation_difference_m` | Diferencia absoluta |

Warning si diferencia > `CLIMATE_ELEVATION_WARNING_THRESHOLD_M` (default 150 m).

Quetzaltenango ~847 hPa es coherente con altitud; no se trata como error automático.

## Precipitación temporal

Campos separados en `forecast_summary`:

| Campo | Ventana |
|-------|---------|
| `precipitation_previous_24h_mm` | Horas modeladas **anteriores** al modelo actual |
| `precipitation_previous_72h_mm` | Idem 72 h (si hay `past_days` suficiente) |
| `precipitation_forecast_next_24h_mm` | Próximas 24 h de pronóstico |
| `precipitation_forecast_next_72h_mm` | Próximas 72 h de pronóstico |

Fuente histórica: `past_days` en una sola llamada Open-Meteo (`CLIMATE_PAST_DAYS=3`).
`precipitation_previous_source = modelled_hourly` — no lluvia observada de estación.

## Timestamps

- Almacenamiento: **UTC ISO8601** (`model_time_utc`, `valid_at`, `fetched_at`, `issued_at`)
- Presentación: `America/Guatemala` vía `timestamp_local` en DTO
- Conversión: `utc_offset_seconds` de Open-Meteo

## Refresh de ubicaciones

Una sola llamada HTTP por ubicación: `current` + `hourly` + `past_days` + `forecast_hours`.

| Variable | Default |
|----------|---------|
| `CLIMATE_REFRESH_CONCURRENCY` | 4 |
| `CLIMATE_PAST_DAYS` | 3 |
| `CLIMATE_FORECAST_HOURS` | 72 |

Ejecución: `batched_parallel` con límite de concurrencia configurable.
Retry solo en errores transitorios; timeout por request.

## Caché

TTL: `CLIMATE_CURRENT_TTL_MINUTES=30`, `CLIMATE_FORECAST_TTL_MINUTES=60`.

`getLocationSnapshot` desglosa latencia:

- `location_ms`, `observation_ms`, `forecast_ms`, `assemble_ms`, `total_ms`

`measureCacheHitLatency(id, 10)` reporta p50 de consultas locales.

## Health ampliado

`GET /api/environment/climate/health` devuelve:

- `provider_reachable`, `provider_latency_ms`
- `database_reachable`
- `last_fetch_status`, `last_success_at`
- `stale_locations_count`, `locations_total`, `locations_fresh`
- `consecutive_failures`

## API (solo lectura)

| Método | Ruta |
|--------|------|
| GET | `/api/environment/climate/health` |
| GET | `/api/environment/climate/locations/:id/snapshot` |
| GET | `/api/environment/climate/locations/:id/hourly?hours=72` |

## Comandos

```bash
npm run climate:register-national-locations
npm run climate:refresh
npm run climate:refresh -- --location=<uuid>
npm run climate:status
```

## Extensión futura

| Proveedor | Uso |
|-----------|-----|
| INSIVUMEH | Estaciones oficiales |
| CHIRPS | Precipitación histórica |
| ERA5/ERA5-Land | Reanálisis |
| NASA GPM | Precipitación satelital |

Nunca fusionar valores de proveedores distintos sin registrar procedencia.

## Merge

1. Rebase contra `main` actual (`b092e59+`)
2. `008` = climate; land cover reserva `009`
3. Conflictos esperados: `package.json`, `server/index.ts` (menores)
4. Ejecutar `npm test` completo antes de merge
