# ESA WorldCover 2021 v200 — Fuente base TerraMind (Commit 7A.2)

## Producto

| Campo | Valor |
|-------|-------|
| Organización | European Space Agency (ESA) |
| Producto | WorldCover Map |
| Versión algoritmo | v200 |
| Año de referencia | **2021** |
| Resolución nominal | 10 m (píxel geográfico; no equivale a exactitud posicional de 10 m) |
| DOI | [10.5281/zenodo.7254221](https://doi.org/10.5281/zenodo.7254221) |
| Licencia | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Acceso | AWS Open Data `s3://esa-worldcover/v200/2021/map/` (sin autenticación) |

## Atribución

© ESA WorldCover project / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium

## Limitaciones

- Snapshot **histórico 2021** — no representa cobertura actual en 2026.
- Cobertura física del suelo (land cover), **no** uso legal del suelo (land use).
- Precisión global reportada ~76.7% (validación independiente v200).
- Cambios 2020↔2021 mezclan algoritmo y cambio real — no usar para detección de cambio sin serie dedicada.

## Tiles Guatemala

Ver `manifest.json` — **4 tiles**, **246.8 MB** descarga total verificada (2026-07-10).

## Artefactos locales (no en Git)

```
data/geo/sources/land-cover/esa-worldcover/2021-v200/
  manifest.json          ← en Git
  SOURCE.md              ← en Git
  SHA256SUMS             ← en Git (hashes tiles + COGs)
  tiles/                 ← descarga (gitignored)
  processed/
    land_cover_gt_4326.tif   ← COG fuente EPSG:4326 recortado ADM0 (~99 MB)
    land_cover_gt_laea.tif   ← COG analítico LAEA-GT nearest (~100 MB)
```

**Procesamiento 7A.2-B (2026-07-10):** mosaico VRT → recorte `gtm_admin0.geojson` → COG 4326 → reproyección LAEA (`lat_0=15.779`, `lon_0=-90.231`, `near`). Almacenamiento COG dual ~199 MB. Área válida LAEA ~108,231 km² (−0.6% vs referencia 108,889 km²).
