# WorldPop Guatemala 2020 — fuente local

Descargado para auditoría 7D.1A. **No commitear rasters.**

| Variante | URL oficial | Versión | Año | Unidad | CRS | Licencia |
|----------|-------------|---------|-----|--------|-----|----------|
| constrained | https://data.worldpop.org/GIS/Population/Global_2015_2030/R2025A/2020/GTM/v1/100m/constrained/gtm_pop_2020_CN_100m_R2025A_v1.tif | R2025A-v1 | 2020 | persons_per_pixel | EPSG:4326 | CC-BY-4.0 |
| unconstrained | https://data.worldpop.org/GIS/Population/Global_2000_2020/2020/GTM/gtm_ppp_2020.tif | Global_2000_2020 | 2020 | persons_per_pixel | EPSG:4326 | CC-BY-4.0 |

Manifest: `population-pipeline-v1`
Última descarga: 2026-07-10T18:50:59.058Z

## Política de reconciliación INE

WorldPop 2020 se compara con **proyección INE 2020**, no con Censo 2018 directamente.
Sin proyección municipal válida → `adjustment_not_applied`.
