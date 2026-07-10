# Climate Intelligence Core (7B.1)

Módulo climático reutilizable de TerraMind. **No está acoplado a incendios** ni modifica
`fire_event_context`, scheduler FIRMS, score ni UI de fuego.

## Rama de trabajo

```text
feature/climate-intelligence-core
worktree: ../terramind-climate
```

## Objetivo

Capa normalizada para consultar, almacenar y servir:

- condiciones actuales / más recientes;
- pronóstico horario (72 h por defecto);
- precipitación reciente y acumulados derivados;
- trazabilidad de proveedor y calidad de datos.

## Arquitectura

```text
ClimateProvider (interfaz)
    └── OpenMeteoProvider (MVP)
ClimateService
    ├── caché / frescura (TTL)
    ├── persistencia Supabase
    └── métricas derivadas puras
API read-only (/api/environment/climate/*)
CLI administrativo (register / refresh / status)
```

### Proveedor inicial: Open-Meteo

- **API:** `https://api.open-meteo.com/v1/forecast`
- **Histórico (archive):** `https://archive-api.open-meteo.com/v1/archive`
- **Licencia:** API gratuita para uso no comercial; revisar [open-meteo.com](https://open-meteo.com/en/terms) antes de producción.
- **Atribución:** Datos modelados por Open-Meteo (no fuente oficial de Guatemala).
- **Timezone:** `America/Guatemala` en todas las ubicaciones nacionales registradas.
- **Unidades internas:** °C, %, mm, km/h, hPa, kPa (VPD cuando aplica).

**Limitaciones conocidas**

- Resolución espacial ~11 km (modelo numérico).
- `current` es interpolación del modelo, no estación local.
- No sustituye INSIVUMEH ni series oficiales.

## Variables mínimas

| Variable interna | Unidad | Fuente Open-Meteo |
|------------------|--------|-------------------|
| `temperature_c` | °C | `temperature_2m` |
| `relative_humidity_pct` | % | `relative_humidity_2m` |
| `precipitation_mm` | mm | `precipitation` |
| `rain_mm` | mm | `rain` |
| `wind_speed_10m_kph` | km/h | `wind_speed_10m` (`wind_speed_unit=kmh`) |
| `wind_direction_10m_deg` | ° | `wind_direction_10m` |
| `wind_gusts_10m_kph` | km/h | `wind_gusts_10m` |
| `cloud_cover_pct` | % | `cloud_cover` |
| `surface_pressure_hpa` | hPa | `surface_pressure` |

## Caché y frescura

| Variable de entorno | Default |
|---------------------|---------|
| `CLIMATE_CURRENT_TTL_MINUTES` | 30 |
| `CLIMATE_FORECAST_TTL_MINUTES` | 60 |
| `CLIMATE_FORECAST_HOURS` | 72 |
| `CLIMATE_PROVIDER` | `open_meteo` |

Si el snapshot en base está fresco, `ClimateService` no vuelve a llamar al proveedor.

## Esquema (migración `008_climate_intelligence_core.sql`)

- `climate_locations` — ubicaciones reutilizables (`location_key` único)
- `climate_observations` — condiciones actuales (`location_id + provider + observed_at`)
- `climate_forecasts` — pronóstico horario (`location_id + provider + issued_at + valid_at`)
- `climate_fetch_runs` — trazabilidad de ingesta

RPC auxiliar: `geo_list_territorial_centroids()` — país + 22 departamentos GT.

## Comandos

```bash
npm run climate:register-national-locations   # 1 país + 22 deptos
npm run climate:refresh                       # todas las ubicaciones activas
npm run climate:refresh -- --location=<uuid>  # una ubicación
npm run climate:status                        # estado y última corrida
```

## API (solo lectura)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/environment/climate/health` | Salud del proveedor |
| GET | `/api/environment/climate/locations/:id/snapshot` | Snapshot consolidado |
| GET | `/api/environment/climate/locations/:id/hourly?hours=72` | Serie horaria |

DTO sanitizado: sin `source_metadata`, URLs internas, credenciales ni stack traces.

## Extensión futura (sin fusionar proveniencia)

| Proveedor | Uso previsto |
|-----------|--------------|
| **INSIVUMEH** | Estaciones oficiales; prioridad de autoridad en observaciones |
| **CHIRPS** | Precipitación histórica y anomalías |
| **ERA5 / ERA5-Land** | Climatología y reanálisis (no refrescos operativos) |
| **NASA GPM** | Precipitación satelital reciente |

Regla: **nunca mezclar valores de proveedores distintos sin registrar procedencia**.

Implementar nuevos proveedores como clases `ClimateProvider` adicionales y selección
por tipo de variable / prioridad en `ClimateService` (commit 7B.2+).

## Estrategia de merge

1. El otro agente termina `007_territorial_protected_areas.sql` en `main`.
2. Esta rama aporta `008_climate_intelligence_core.sql` (numeración revisada al merge).
3. Sin conflictos esperados en: `fire_event_context`, scheduler, UI incendios.
4. Posible conflicto menor en `server/index.ts` y `package.json` — resolver añadiendo rutas climate.

## Pruebas

```bash
npm test -- src/modules/climate
```

Cubre: mapping, timezone, unidades, nulls, retry, caché, DTO seguro, 23 ubicaciones.
