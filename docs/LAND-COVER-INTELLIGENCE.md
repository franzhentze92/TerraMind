# Cobertura del suelo — TerraMind (Commits 7A.2-A/B/C)

**Estado:** raster nacional preparado · `LandCoverService` operativo (7A.2-C) · migración `009` **no aplicada**.

## 1. Fuente

| Campo | Valor |
|-------|-------|
| Fuente | ESA WorldCover 2021 v200 |
| DOI | 10.5281/zenodo.7254221 |
| Licencia | CC BY 4.0 |
| Resolución nominal | 10 m |
| Año referencia | **2021** |
| CRS fuente | EPSG:4326 |
| Clases | 11 (+ nodata 0) |
| Manglar | Clase **95** — separada de humedal **90** |

**Semántica:** land cover (cobertura física), no land use (uso legal).

## 2. Arquitectura (7A.2-C)

```text
src/modules/territory/land-cover/
  land-cover.types.ts
  land-cover-taxonomy.ts
  land-cover.service.ts
  land-cover-context-version.ts
  land-cover-warnings.ts
  raster/
    land-cover-raster-engine.ts
    raster-artifacts.ts
    raster-distribution.ts
    raster-geometry.ts
    raster-point-sampler.ts
    raster-zone-analyzer.ts
    raster-temp.ts
  audit/
    land-cover-audit.ts
    land-cover-benchmark.ts
    boundary-area.ts
  providers/esa-worldcover/
  processing/          ← pipeline descarga/COG (7A.2-B)

src/pipeline/engines/fire/context/
  fire-land-cover.adapter.ts   ← stub (7A.2-D)
```

### API interna

```typescript
LandCoverService.getSourceStatus()
LandCoverService.samplePoints({ points })
LandCoverService.analyzeGeometry({ geometry, geometryCrs })
LandCoverService.analyzeBuffers({ points, radiiMeters, unifyBuffers })
```

Reutilizable por: incendios, municipios, áreas protegidas, parcelas, cuerpos de agua.

### Buffers múltiples

1. Puntos WGS84 → reproyección LAEA (`ogr2ogr -t_srs`)
2. `ST_Union(ST_Buffer(geometry, radius_m))` por radio (SQLite/GEOS)
3. Recorte raster con `gdalwarp -cutline -cutline_srs LAEA -crop_to_cutline`
4. Histograma GDAL → distribución por clase (nodata excluido)

**CRS buffers:** LAEA Guatemala (`lat_0=15.779`, `lon_0=-90.231`)  
**Unión:** `ogr-st-union-laea-meters`  
**Resampling:** `near` (categórico)

## 3. Artefactos locales

| Archivo | CRS | Tamaño | Uso |
|---------|-----|--------|-----|
| `processed/land_cover_gt_4326.tif` | EPSG:4326 | ~99 MB | Muestreo de puntos |
| `processed/land_cover_gt_laea.tif` | LAEA-GT | ~100 MB | Estadísticas zonales / % área |

Boundary de recorte: `data/geo/sources/hdx-cod-ab-guatemala/.../gtm_admin0.geojson`

## 4. Auditoría de área nacional (7A.2-C)

Referencia operativa TerraMind = **boundary ADM0 versionado**, no 108,889 km² (constante obsoleta).

| Métrica | km² |
|---------|-----|
| HDX `area_sqkm` (propiedad GeoJSON) | 108,231.37 |
| Boundary geodésico (esfera WGS84) | 108,853.66 |
| Boundary LAEA planar (`ST_Area`) | **108,238.90** |
| Raster LAEA válido (máscara ADM0) | **108,231.33** |
| **Δ raster − boundary LAEA** | **−7.57 (−0.007%)** |

**Explicación del Δ:** rasterización de borde + resolución ~9.08 m + recorte previo al COG.  
~27,048 píxeles válidos fuera del boundary (~2.23 km²) en el COG sin máscara final.  
Nodata dentro del boundary: **0**.

## 5. Auditoría de clases nacionales

Distribución validada sobre COG LAEA enmascarado con ADM0 (solo píxeles válidos):

| Clase | % | km² |
|-------|---|-----|
| Bosque (10) | 62.6 | 67,777 |
| Pastizal (30) | 27.2 | 29,396 |
| Cultivo (40) | 4.2 | 4,541 |
| Matorral (20) | 3.5 | 3,803 |
| Urbano (50) | 1.3 | 1,380 |
| Agua (80) | 0.6 | 662 |
| Humedal (90) | 0.2 | 269 |
| Manglar (95) | 0.2 | 244 |
| Desnudo (60) | 0.1 | 157 |
| **Suma** | **99.9%** | — |

Integridad: mismos códigos en COG 4326 y LAEA; sin códigos inventados; manglar ≠ humedal.

## 6. Puntos de control manual

| Punto | Lat/Lon | Código | Clase | ¿Razonable? |
|-------|---------|--------|-------|-------------|
| Petén central | 16.9, −90.5 | 10 | forest | ✓ |
| Costa sur agrícola | 14.0, −91.0 | 40 | cropland | ✓ |
| Altiplano | 15.03, −91.72 | 20 | shrubland | ✓ |
| Ciudad de Guatemala | 14.63, −90.51 | 50 | built_up | ✓ |
| Manglares Pacífico | 13.95, −90.65 | 95 | mangrove | ✓ |
| Lago de Atitlán | 14.7, −91.2 | 80 | permanent_water | ✓ |
| Fuera de GT | 15.0, −87.5 | — | nodata | ✓ |

## 7. Benchmark dual COG (7A.2-C)

Warm-up ~2.3 s · 10 repeticiones · radios 500 m / 1 km / 3 km · buffers unificados.

| Caso | Estrategia | p50 | p95 |
|------|------------|-----|-----|
| 1 punto | LAEA directo | 1.7 s | 1.9 s |
| 1 punto | Warp 4326→LAEA | 1.9 s | 2.0 s |
| 5 puntos | LAEA directo | 40.3 s | 46.2 s |
| 5 puntos | Warp on-demand | 44.4 s | 50.1 s |
| 3 puntos | LAEA directo | 28.3 s | 33.0 s |
| 3 puntos | Warp on-demand | 28.2 s | 34.6 s |

- Δ distribución máx entre estrategias: ~0.5%
- Δ área máx: ~2.1 ha

**Decisión 7A.2-C:** rendimiento **equivalente** en mediana. **Conservar ambos COG** por ahora:
- LAEA simplifica áreas métricas y evita reproyección por consulta.
- Warp on-demand es viable (~100 MB menos) si la carga operativa en 7A.2-D lo justifica.

## 8. `context_version`

Hash SHA-256 (16 hex) de:

```text
source_version | raster_hash | mapper_version | analysis_method_version |
radii_sorted | nodata_policy | area_strategy | buffer_union_method
```

## 9. Warnings

`source_unavailable` · `raster_hash_mismatch` · `point_nodata` · `point_outside_coverage` · `incomplete_zone_coverage` · `mixed_point_classes` · `outdated_source_year` · `invalid_geometry` · `raster_processing_failed`

## 10. Comandos

```bash
npm run land-cover:download    # idempotente (7A.2-B)
npm run land-cover:build
npm run land-cover:validate
npm run land-cover:audit       # 7A.2-C
npm run land-cover:benchmark   # 7A.2-C (~25 min Windows)
npm test
```

## 11. Pruebas

- **Unitarias:** mapper, context_version, warnings, servicio con mocks
- **Integración:** `describe.skipIf(!COG)` — no descarga en CI
- Timeout extendido para buffers GDAL (~2 min)

## 12. Limitaciones

| Tema | Nota |
|------|------|
| WorldCover 2021 | Snapshot histórico; no condición actual 2026 |
| GDAL Windows | `proj.db` ausente — warnings PROJ; operaciones funcionan con proj4 explícito |
| Subprocess | ~1–40 s por evento multi-buffer; no apto para consulta por píxel |
| Alternativa futura | Python+rasterio, microservicio raster, o precomputación si >100 eventos/min |

## 13. Commits

| Commit | Alcance |
|--------|---------|
| 7A.2-A | planificación |
| 7A.2-B | descarga + COG (`a6bc7c4`) |
| **7A.2-C** | auditoría + benchmark + LandCoverService |
| 7A.2-D | adaptador incendios + persistencia |
| 7A.2-E | API + UI |
| 7A.2-F | scheduler |

**No aplicado:** `009_land_cover_context.sql`  
**No tocar:** Climate Core · `fire-pipeline.job.ts` hasta 7A.2-F
