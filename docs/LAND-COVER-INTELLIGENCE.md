# Cobertura del suelo — TerraMind (Commit 7A.2)

Documento de diseño aprobado con correcciones arquitectónicas.  
**Estado:** planificación — raster **no descargado** aún.

## 1. Fuente aprobada

| Campo | Valor |
|-------|-------|
| Fuente | ESA WorldCover 2021 v200 |
| DOI | 10.5281/zenodo.7254221 |
| Licencia | CC BY 4.0 |
| Resolución nominal | 10 m |
| Año referencia | **2021** |
| CRS fuente | EPSG:4326 (WGS84 geográfico) |
| Clases | 11 (+ nodata 0) |
| Manglar | Clase 95 — separada |

**Semántica:** land cover (cobertura física), no land use (uso legal).  
**Precisión:** ~76.7% accuracy global (validación v200). 10 m ≠ exactitud posicional de 10 m.

## 2. Arquitectura de módulos

```text
src/modules/territory/land-cover/          ← servicio genérico
  land-cover.types.ts
  land-cover-taxonomy.ts
  land-cover.service.ts
  land-cover-raster.ts                     ← Commit 7A.2-C
  providers/esa-worldcover/
    esa-worldcover.mapper.ts
    esa-worldcover.manifest.ts
    esa-worldcover.provider.ts             ← Commit 7A.2-C

src/pipeline/engines/fire/context/
  fire-land-cover.adapter.ts               ← adaptador delgado incendios

src/modules/fires/                           ← solo DTO/UI (Commit 7A.2-E)
  utils/land-cover-context.dto.ts
```

### API interna del servicio

```typescript
LandCoverService.samplePoints(points)
LandCoverService.analyzeGeometry(geometry)
LandCoverService.analyzeBuffers({ points, zone_radii_m, unify_zone_buffers: true })
LandCoverService.getSourceStatus()
```

Reutilizable por: eventos térmicos, municipios, áreas protegidas, parcelas, cuerpos de agua.

## 3. Dos conceptos de análisis

### A. `point_distribution`
Clases en las **detecciones FIRMS reales** (o centroide con warning `centroid_fallback_used`).

### B. `zone_distribution`
Composición del **entorno unificado** por radio. Para varias detecciones:

```sql
ST_UnaryUnion(
  ST_Collect(
    ST_Buffer(detection.location::geography, radius_m)::geometry
  )
)
```

Un solo muestreo raster por radio — sin doble conteo de buffers superpuestos.

## 4. Estrategia de área de píxeles

### Problema
EPSG:4326: área de píxel varía con latitud. Conteo simple × resolución² introduce error en porcentajes nacionales y por buffer.

### Opciones evaluadas

| Opción | Veredicto |
|--------|-----------|
| A. Conteo simple en EPSG:4326 | ❌ Error latitudinal no documentado |
| B. UTM 16N para todo Guatemala | ❌ Este (88°W) está en UTM 15N; oeste en 16N |
| C. UTM por zona (15N + 16N) | ⚠️ Viable pero complejo en bordes |
| D. **LAEA centrado en Guatemala** | ✅ **Recomendado** |
| E. Área geodésica por fila en 4326 | ✅ Alternativa sin segundo COG; más lento |

### Decisión: **D — COG analítico LAEA**

| Artefacto | CRS | Uso |
|-----------|-----|-----|
| `land_cover_gt_source_4326.tif` | EPSG:4326 | Inmutable, muestreo de puntos |
| `land_cover_gt_analytic_laea.tif` | LAEA custom | Estadísticas de zona / porcentajes |

**Proj4 analítico (Guatemala centroid):**

```text
+proj=laea +lat_0=15.779448 +lon_0=-90.230870 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs
```

| Métrica | Valor esperado |
|---------|----------------|
| Distorsión de área nacional | < 0.5% vs geodésico |
| Impacto en % por buffer | Despreciable a escala 500 m–3 km |
| Costo one-time warp | ~2–5 min (GDAL 3.10, 4 tiles) |
| Píxel analítico | ~10 m equivalente (resample bilinear/nearest documentado) |

**Por qué no EPSG:6933 (EASE-Grid 2.0):** diseñado para grillas globales gruesas; remuestrear 10 m nacional introduce artefactos innecesarios.

## 5. Modelo de datos (extensible)

### `fire_event_land_cover_context`

| Campo | Tipo | Notas |
|-------|------|-------|
| event_id | uuid PK | |
| context_version | text | hash compuesto (ver §8) |
| source_layer_id | uuid FK | territorial_layers |
| source_version | text | 2021-v200 |
| reference_year | int | 2021 |
| point_distribution | jsonb | clases en detecciones |
| status | text | complete/partial/unavailable/error |
| warnings | jsonb | códigos |
| generated_at / updated_at | timestamptz | |

**No** columnas rígidas por radio. Resúmenes 1 km (forest_pct, etc.) son **vistas derivadas** de zones, no fuente de verdad.

### `fire_event_land_cover_zones`

| Campo | Tipo |
|-------|------|
| id | uuid PK |
| event_id | uuid FK |
| radius_m | int |
| dominant_class | text |
| class_distribution | jsonb |
| herbaceous_wetland_pct | numeric |
| mangrove_pct | numeric |
| valid_pixel_count | int |
| nodata_pixel_count | int |
| data_coverage_pct | numeric |
| analyzed_area_ha | numeric |
| context_version | text |
| generated_at | timestamptz |

**Unique:** `(event_id, radius_m, context_version)`

`total_wetland_related_pct` = derivado en DTO/UI, no almacenado como única cifra de humedal.

## 6. Tiles Guatemala — verificados (sin descarga)

BBox HDX `gtm_admin0`: 13.74°N–17.82°N, 92.24°W–88.22°W

| Tile ID | S3 URI | Tamaño |
|---------|--------|--------|
| N12W090 | `s3://esa-worldcover/v200/2021/map/ESA_WorldCover_10m_2021_v200_N12W090_Map.tif` | 77.2 MB |
| N12W093 | `s3://esa-worldcover/v200/2021/map/ESA_WorldCover_10m_2021_v200_N12W093_Map.tif` | 32.5 MB |
| N15W090 | `s3://esa-worldcover/v200/2021/map/ESA_WorldCover_10m_2021_v200_N15W090_Map.tif` | 47.4 MB |
| N15W093 | `s3://esa-worldcover/v200/2021/map/ESA_WorldCover_10m_2021_v200_N15W093_Map.tif` | 89.8 MB |

| Métrica | Valor |
|---------|-------|
| Tiles | **4** (no 6–9) |
| Descarga total | **246.8 MB** |
| Disco libre (planificación) | ~30 GB |
| COG recortado estimado | 120–200 MB |
| COG analítico LAEA estimado | 120–200 MB |
| Almacenamiento total estimado | 250–400 MB |

Ver `data/geo/sources/land-cover/esa-worldcover/2021-v200/manifest.json`.

## 7. `context_version`

Hash SHA-256 truncado de:

```text
source_version | cog_sha256 | mapper_version | analysis_method_version | radii | nodata_policy
```

Ejemplo: `2021-v200|abc…|esa-worldcover-v200-mapper-v1|laea-zone-stats-v1|0,500,1000,3000|exclude-zero`

## 8. Warnings

- `source_unavailable`
- `point_nodata`
- `incomplete_zone_coverage` (data_coverage_pct < 95%)
- `mixed_point_classes`
- `centroid_fallback_used`
- `low_confidence_for_point_interpretation`
- `outdated_source_year` (siempre presente como recordatorio 2021 vs 2026)

## 9. UI (Territorio)

Sección **Cobertura del suelo** con:

- Año del producto: **2021**
- Cobertura en detecciones
- Composición del entorno (500 m, 1 km, 3 km)
- `herbaceous_wetland_pct` y `mangrove_pct` separados
- Disclaimer temporal + clasificación

Texto ejemplo:

> Según ESA WorldCover 2021, las detecciones se encuentran sobre cobertura clasificada como cultivo.

## 10. Commits planificados

| Commit | Alcance |
|--------|---------|
| **7A.2-A** | manifest + plan-tiles + docs + tipos (este paso) |
| **7A.2-B** | descarga + mosaic + COG fuente + validación + SHA256 |
| **7A.2-C** | LandCoverService + raster GDAL + LAEA |
| **7A.2-D** | adaptador incendios + persistencia + CLI enrich |
| **7A.2-E** | API + UI + pruebas + 5 eventos |
| **7A.2-F** | scheduler (flag `LAND_COVER_ENRICHMENT_ENABLED=false` → true) |

**No modificar** `fire-pipeline.job.ts` hasta 7A.2-F.

## 11. Riesgos Windows / GDAL

| Riesgo | Mitigación |
|--------|------------|
| GDAL 3.10 CLI disponible | ✅ Verificado en entorno |
| `rasterio` no instalado | Usar subprocess `gdalwarp`, `gdalinfo`, o añadir `gdal-async` |
| Paths con espacios | Usar rutas absolutas entrecomilladas |
| Memoria mosaic 4 tiles | ~250 MB descarga; warp streaming con GDAL_CACHEMAX |
| Lock S3 lento | Descarga secuencial con reintentos |
| Sin Python rasterio | Node + GDAL CLI es suficiente para MVP |

## 12. Rollback

1. `territorial_layers.is_active = false` para `gt_land_cover`
2. No borrar contextos derivados salvo purge explícito
3. Eliminar COGs locales; manifest permanece
4. Migración down: drop zones + context tables

## 13. Conflictos con agente climático

- No tocar `src/sources/climate/**`
- No modificar `fire-pipeline.job.ts` en fases A–E
- Rama recomendada: `feature/7a2-land-cover`
