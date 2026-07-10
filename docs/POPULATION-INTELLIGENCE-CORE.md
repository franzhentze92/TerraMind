# Population Intelligence Core (7D.1)

Módulo territorial genérico de TerraMind para estimar y analizar **población residente** dentro de geometrías o radios. Reutilizable por incendios, inundaciones, sequía, áreas protegidas, cuencas e infraestructura. **No** está acoplado a `fire_events`.

## Estado actual

| Fase | Estado |
|------|--------|
| Investigación de fuentes | Completada |
| Arquitectura y tipos | Completada (rama `feature/population-intelligence-core`) |
| **7D.1A WorldPop audit** | **Completada** — ver `docs/reports/population-worldpop-2020-audit.md` |
| Migración 011 | Propuesta — **no aplicada** |
| PopulationService operativo | **Pendiente** (7D.1B) |
| Datos administrativos INE | **Pendiente** (7D.2) |
| Adaptadores / API / UI | **Pendiente** (7D.3–7D.4) |

## Problema

TerraMind necesita responder, de forma reproducible y ética:

- ¿Cuánta población residente **estimada** hay cerca de un punto o dentro de una geometría?
- ¿Cuáles son las cifras **oficiales** por departamento/municipio?
- ¿Cuál es el asentamiento más cercano?

Sin confundir proximidad espacial con afectación, evacuación o presencia en tiempo real.

## Arquitectura

```
src/modules/territory/population/
  population.types.ts
  population.service.ts              # Orquestación (stub 7D.1)
  population-context-version.ts
  population-quality.ts
  population-warnings.ts
  population-source-registry.ts
  population-disclaimer.ts
  providers/
    worldpop/worldpop.manifest.ts
    ghsl/ghsl.manifest.ts
    ine/ine.manifest.ts
  raster/
    population-raster-reader.ts      # Diseño — sin raster montado
    population-zonal-statistics.ts
  admin/
    population-admin.service.ts
  adapters/future/
    fire-population.adapter.ts       # Solo interfaz documentada
```

Flujo futuro:

```
geometría o puntos + radios
  → unión de buffers (ST_UnaryUnion)
  → PopulationRasterReader (ventana COG)
  → zonal statistics (suma píxeles, cobertura, densidad)
  → reconciliación opcional con INE (factor municipal)
  → PopulationEstimate + warnings
  → entity_population_context (Supabase)
```

## Semántica obligatoria

| Concepto | Código interno | Uso en UI |
|----------|----------------|-----------|
| Cifra oficial administrativa | `official_administrative_population` | "Población oficial municipal según INE." |
| Estimación espacial modelada | `modelled_spatial_population` | "Población residente estimada dentro de 1 km según raster poblacional." |

**No usar** cuando solo hay proximidad espacial:

- "personas afectadas"
- "personas evacuadas"
- "personas presentes actualmente"
- "población exacta"

### Disclaimer obligatorio

> Estimación espacial de población residente. La proximidad a una situación ambiental no implica afectación confirmada ni presencia en tiempo real.

## Comparación de fuentes

### A. WorldPop

| Campo | Valor |
|-------|-------|
| Organización | University of Southampton — WorldPop |
| Producto | Constrained individual countries 2015–2030 (100 m) |
| Versión | R2025A v1 (HDX); R2024B beta también publicada |
| Año de referencia | 2015, 2020, 2025, 2030 (por archivo) |
| Resolución | ~100 m (3 arcsec, WGS84) |
| Formato | GeoTIFF (por país/año) |
| CRS | EPSG:4326 (WGS84) |
| Unidad raster | personas por píxel (float) |
| Tipo población | Residente estimada (constrained dasymetric) |
| Modelo | Constrained (Random Forest dasymetric + covariables; edificios OSM/Microsoft en variantes) |
| Método | Desagregación dasimétrica desde unidades administrativas con capas de peso |
| Cobertura Guatemala | Sí — `gtm_pop_2020_cn_100m.tif` (~16 MB país completo) |
| Acceso | [WorldPop Hub](https://hub.worldpop.org/), [HDX GTM](https://data.humdata.org/dataset/worldpop-population-counts-2015-2030-gtm) |
| Tamaño estimado | ~16 MB (100 m constrained 2020); ~50 MB (unconstrained UN-adjusted legacy) |
| Licencia | CC BY 4.0; variantes con OSM/Microsoft → ODbL |
| Atribución | Bondarenko et al. 2025, DOI:10.5258/SOTON/WP00839 |
| Uso comercial | Permitido con atribución (CC BY 4.0) |
| Actualización | Serie 2015–2030 en evolución; revisar versión R* al importar |
| Ventajas | Resolución fina; archivos por país; documentación clara; tamaño manejable para Guatemala |
| Limitaciones | No es censo oficial; totales raster ≠ INE municipal sin ajuste |
| Sesgos | Sesgo hacia áreas con mejor cartografía de edificios/carreteras; subestima dispersión rural sin infraestructura mapeada |
| Idoneidad TerraMind | **Alta** como capa espacial modelada principal |

### B. GHSL / GHS-POP

| Campo | Valor |
|-------|-------|
| Organización | European Commission — JRC |
| Producto | GHS-POP R2023A — GHS population grid multitemporal (1975–2030) |
| Versión | R2023A / P2023A |
| Año de referencia | 1975–2020 (5 años); proyecciones 2025, 2030 |
| Resolución | 100 m (Mollweide EPSG:54009); 3 arcsec WGS84 derivado |
| Formato | GeoTIFF en ZIP (global o por tile) |
| CRS | EPSG:54009 (analytic) y EPSG:4326 (geographic) |
| Unidad raster | habitantes por celda (float) |
| Tipo población | Población residencial |
| Modelo | Desagregación desde GPWv4.11 informada por GHSL built-up volume |
| Método | Dasimétrico con volumen construido y no-residencial |
| Cobertura Guatemala | Sí (recorte de mosaico global) |
| Acceso | [JRC Data Catalogue](https://data.jrc.ec.europa.eu/dataset/2ff68a52-5b5b-4a22-8f40-c41da8332cfe), Google Earth Engine |
| Tamaño estimado | Mosaico global 100 m muy grande; requiere recorte COG a Guatemala (~decenas MB tras clip) |
| Licencia | Reutilización autorizada con atribución (EC reuse conditions) |
| Atribución | Schiavina et al. 2023, doi:10.2905/2FF68A52-5B5B-4A22-8F40-C41DA8332CFE |
| Uso comercial | Generalmente permitido con atribución |
| Actualización | Multitemporal hasta 2030; cadencia ~anual en releases GHSL |
| Ventajas | Consistencia con capas GHSL urbanas; serie histórica larga; metodología publicada |
| Limitaciones | Descarga global pesada; base GPW/UN no INE; proyecciones 2025–2030 son modeladas |
| Sesgos | Sesgo hacia asentamiento construido; costa/censo administrativo revisado pero no guatemalteco oficial |
| Idoneidad TerraMind | **Media-alta** — buen respaldo o validación cruzada, no primera opción por peso de extracción |

### C. INE Guatemala

| Campo | Valor |
|-------|-------|
| Organización | Instituto Nacional de Estadística (INE) |
| Producto | XII Censo Nacional de Población y VII de Vivienda 2018 |
| Versión | Censo 2018 (+ proyecciones publicadas) |
| Año de referencia | 2018 (censo); proyecciones posteriores |
| Resolución | Administrativa: departamento (22), municipio (340), lugar poblado (~20,254 centroides) |
| Formato | CSV, XLSX, Shapefile (lugares poblados), portales web |
| CRS | WGS84 en shapefiles de lugares poblados |
| Unidad | personas (conteo oficial), hogares, viviendas |
| Tipo población | Población residente censada (oficial) |
| Modelo | N/A — enumeración censal |
| Método | Censo de campo 2018 |
| Cobertura Guatemala | Nacional completa |
| Acceso | [censo2018.ine.gob.gt](https://censo2018.ine.gob.gt/), [datos.ine.gob.gt](https://datos.ine.gob.gt/) |
| Tamaño estimado | Tablas agregadas < 50 MB; microdatos mayores (uso restringido ético) |
| Licencia | Datos públicos institucionales |
| Atribución | INE, XII Censo 2018 |
| Uso comercial | Datos agregados públicos; microdatos con restricciones de privacidad |
| Actualización | Censo cada ~10 años; proyecciones periódicas |
| Ventajas | **Única fuente oficial** para totales administrativos y reconciliación |
| Limitaciones | Sin raster; censo 2018 desactualizado vs 2026; lugares poblados por autoidentificación |
| Sesgos | Subenumeración histórica; nombres de lugares no siempre oficiales administrativamente |
| Idoneidad TerraMind | **Obligatoria** como capa `official_administrative_population` |

### D. GeoQuetzal (derivado INE + MINFIN)

| Campo | Valor |
|-------|-------|
| Organización | Comunidad académica (derivado) |
| Producto | API Python: límites + microdatos censo 2018 particionados |
| Versión | Releases GitHub (Parquet/GeoJSON) |
| Año de referencia | 2018 |
| Resolución | Admin + lugar poblado |
| Formato | Parquet, GeoJSON |
| CRS | WGS84 |
| Licencia | Pública (datos INE/MINFIN); GADM zonas → académica/no comercial |
| Idoneidad TerraMind | **Útil para ETL 7D.2**, no fuente primaria citada al usuario |

## Decisión de fuentes (7D.1)

### Capa A — Población administrativa oficial

- **Fuente principal:** INE Guatemala (censo 2018 + proyecciones publicadas).
- **Uso:** totales departamento/municipio, urbano/rural, hogares, año de referencia.
- **Nunca** presentar raster como cifra oficial.

### Capa B — Distribución espacial estimada

- **Fuente recomendada:** **WorldPop constrained 100 m** (`gtm_pop_2020_cn_100m.tif` o año acordado en 7D.1A).
- **Respaldo / validación cruzada:** GHSL GHS-POP R2023A (muestra o departamentos).
- **Uso:** radios, polígonos, densidad, proximidad a asentamientos vía raster + puntos INE.

### Archivos raster iniciales propuestos (7D.1A)

| Archivo | Año | Tamaño ~ | Notas |
|---------|-----|----------|-------|
| `gtm_pop_2020_cn_100m.tif` | 2020 | 16.2 MB | Primario |
| `gtm_pop_2020_cn_1km.tif` | 2020 | 0.5 MB | QA / benchmark rápido |
| COG recortado LAEA-GT (derivado) | 2020 | ~20–40 MB | Analítico local |

## Estrategia raster (propuesta)

| Opción | Decisión |
|--------|----------|
| A. COG recortado a Guatemala | **Sí** — almacenamiento versionado fuera de Git |
| B. Reproyección LAEA-GT | **Sí** — COG analítico para área/buffers métricos (patrón land-cover) |
| C. Procesamiento por ventana | **Sí** — lectura parcial con GDAL/rasterio o geotiff.js |
| D. PostGIS Raster | **No inicial** — complejidad operativa; evaluar si benchmarks lo exigen |
| E. GDAL/rasterio en pipeline | **Sí** — build/validate en `processing/` (futuro 7D.1A) |
| F. Servicio externo | **No** — dependencia y semántica inconsistente |

Almacenar en Supabase **solo resultados derivados** (`entity_population_context`, `entity_population_zones`), no cada píxel.

## Método de área y buffers

Radios iniciales: **500 m, 1 km, 3 km, 5 km** (no 10 km).

Para múltiples puntos:

```sql
ST_UnaryUnion(
  ST_Collect(
    ST_Buffer(point::geography, radius_m)::geometry
  )
)
```

Equivalente en aplicación: unir buffers en CRS métrico (LAEA-GT) antes de zonal stats. **No sumar** buffers superpuestos por separado.

## Política de reconciliación INE (7D.1A)

- **No** reconciliar WorldPop 2020 contra Censo 2018 directamente.
- Usar **proyección INE 2020** (nacional y departamental) para comparación año-compatible.
- Sin proyección municipal válida → `adjustment_not_applied`, conservar raw estimate.
- Nunca presentar Δ 2018 vs 2020 como discrepancia del raster sin separar crecimiento y metodología.

## Resultado auditoría 7D.1A (resumen)

| Producto | Suma nacional (ADM0) | Δ vs INE 2020 |
|----------|----------------------|---------------|
| Constrained R2025A | ~17.20 M | ~4.4% |
| Unconstrained 2020 | ~17.69 M | ~1.6% |
| INE proyección 2020 | 17.98 M | — |

**Recomendación: Opción C (dual_use)** — constrained para exposición urbana/buffers; unconstrained como validación nacional; Petén y zonas rurales requieren criterio local (unconstrained sobreestima Petén ~37% vs INE departamental).

Scripts: `npm run population:download-worldpop|prepare-worldpop|audit-worldpop|benchmark-worldpop`

Datos locales: `data/population/worldpop/` (fuera de Git excepto manifest/SOURCE.md).

## Reconciliación INE (diseño — no implementada)

```
factor_municipal = official_population_ine / raw_raster_population_sum
adjusted_pixel_population = raw_pixel_population * factor_municipal
```

Guardar siempre: `raw`, `adjusted`, `adjustment_factor`, fuente administrativa, año. No sobrescribir silenciosamente.

Precondiciones: códigos municipales validados, diferencias documentadas, metodología aprobada.

## Validación raster (checklist 7D.1A)

- CRS, bounds, resolución, nodata, dtype, unidad
- Suma nacional vs INE (+ diferencia %)
- Suma por departamento (muestra)
- Píxeles negativos / no finitos
- Cobertura fuera de Guatemala
- Checksum SHA-256, tamaño

## Asentamientos (investigación — no implementado)

| Fuente | Tipo | Licencia | Notas |
|--------|------|----------|-------|
| INE lugares poblados 2018 | Centroides + población agregada | Pública | **Preferida** (fase 7D.2+) |
| MINFIN TopoJSON | Límites admin | Pública | Ya usado en geo |
| IGN | Nombres oficiales | Verificar | Complemento |
| OSM `place=*` | POI comunitario | ODbL | No única fuente |
| HDX | Mirrors WorldPop | CC BY | No para asentamientos |

Implementar `getNearestSettlements` solo tras validar licencia y códigos INE.

## Context version

Determinístico (SHA-256 truncado) desde:

- source, source_version, raster_hash, reference_year
- analysis_method, CRS, buffer_radii, nodata_policy
- adjustment_method, settlement_dataset_version

## Calidad y warnings

Ver `population-quality.ts` y `population-warnings.ts`. Códigos mínimos implementados en diseño.

## Privacidad y ética

- Solo agregados espaciales; sin perfiles individuales ni microdatos expuestos.
- No estimar población de una vivienda específica.
- No usar pobreza, etnicidad, discapacidad ni edad en scores (fase actual).
- No publicar agregados bajo umbrales inseguros.

## Uso futuro en eventos

Ver `adapters/future/fire-population.adapter.ts`. Flujo:

```
detecciones → buffers unificados → PopulationService → persistencia → API → UI
```

Ejemplo UI correcto:

```
Población estimada dentro de:
  500 m: 1,240
  1 km: 4,870
  3 km: 18,620

Asentamiento más cercano: Champerico · 2.1 km
```

## Módulo visual futuro

- Tarjeta Situación Nacional: "Población y exposición"
- Página `/poblacion`
- Explorador: densidad, asentamientos, límites, proyecciones
- Detalle evento: Territorio → Población y asentamientos

## Pruebas de concepto (7D.1 — metadata)

Zonas de referencia (sin persistir):

| Zona | Lat | Lon | Notas PoC |
|------|-----|-----|-----------|
| Ciudad de Guatemala | 14.6349 | -90.5069 | Alta densidad; validar coherencia urbana |
| Champerico | 14.2883 | -91.9081 | Costa sur; municipio costero |
| Reserva Biosfera Maya | 17.7500 | -89.5000 | Baja densidad; cobertura forestal |
| Corredor Seco | 14.7500 | -89.3500 | Rural disperso; sesgo dasimétrico |
| Lago de Atitlán | 14.6833 | -91.2000 | Turismo + pueblos; mixto |

PoC ejecutado vía `scripts/population-source-poc.ts`: valida manifiestos, zonas dentro de bounds, totales INE de referencia publicados, sin descarga raster.

## Benchmark plan (futuro)

Escenarios: punto, 500 m–5 km, municipio, cuenca, área protegida.

Métricas: p50, p95, memoria, apertura raster, ventana, zonal, caché.

## Rollback

1. Rama/worktree aislado — no merge a `main` hasta aprobación.
2. Migración 011 no aplicada — rollback = no ejecutar SQL.
3. Rasters en almacenamiento externo versionado — eliminar artifact + hash.
4. `entity_population_*` — truncate por `context_version` si se requiere recomputar.

## Agregar otra fuente

1. Registrar en `population-source-registry.ts`
2. Crear `providers/<code>/<code>.manifest.ts`
3. Extender migración `population_sources` / `population_raster_datasets`
4. Actualizar `buildPopulationContextVersion` si cambia metodología
5. Documentar licencia y semántica en este archivo

## Conflictos con otros agentes

**No modificar:**

- `src/modules/territory/land-cover/`
- `src/modules/biodiversity/`
- `src/modules/climate/`
- `fire_event_context`, `FireAnalysisPage`, `NationalSituationPage`
- `server/routes/biodiversity.ts`, `server/routes/fires.ts`
- migraciones 008–010

## Commits en esta rama

1. `docs(population): source research and architecture (7D.1)`
2. `feat(population): types and service interface (7D.1)`
3. `feat(population): source registry and provider manifests (7D.1)`
4. `feat(population): raster and admin design stubs (7D.1)`
5. `feat(population): proposed SQL schema 011 (7D.1)`
6. `test(population): context version, warnings, poc script (7D.1)`
