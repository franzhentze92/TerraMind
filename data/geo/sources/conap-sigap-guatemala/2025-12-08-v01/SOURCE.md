# CONAP SIGAP — Límites geoespaciales (Guatemala)

## Dataset

| Campo | Valor |
|-------|-------|
| **Título** | Límites geoespaciales del SIGAP |
| **Entidad** | Consejo Nacional de Áreas Protegidas (CONAP) — Dirección de Análisis Geoespacial |
| **URL institucional** | https://conap.gob.gt/direccion-de-analisis-geoespacial/ |
| **Artefacto local** | `SIGAP_08122025_IP.*` |
| **Versión TerraMind** | `2025-12-08-v01` |
| **Fecha del artefacto** | 2025-12-08 (nombre de archivo oficial) |
| **Fecha de ingesta TerraMind** | 2026-07-10 |

## Licencia

| Campo | Valor |
|-------|-------|
| **license** | No declarada explícitamente |
| **terms_status** | `requires_confirmation` |

No se incluye archivo de licencia en el ZIP. Para uso comercial o redistribución de geometrías, confirmar condiciones con CONAP.

**Atribución requerida:**

> Límites geoespaciales del SIGAP — CONAP

## Archivos y hashes SHA-256

| Archivo | SHA-256 |
|---------|---------|
| `SIGAP_08122025_IP.shp` | `1442cd7d3e1eafbb7b9488592d93e2e3a206c8f352ac5e7d79c41acf338947b5` |
| `SIGAP_08122025_IP.dbf` | `21ba4c0e01a2bdc4a3bfcca8dd5c09c9ea357ec1d4926f8f6f06a1b439206f3f` |
| `SIGAP_08122025_IP.shx` | `3d698ffc6c7cdeb91f706edbde6b892445b0e663a101ba41676a316cae92b1d8` |
| `SIGAP_08122025_IP.prj` | `69c9253848188952b4dc5810366ace878eb739dfea9448bf6d0a76b9e520e670` |

## CRS

| Campo | Valor |
|-------|-------|
| **CRS original** | GTM — Transverse Mercator basado en WGS 84, unidades metros |
| **Autoridad** | ESRI:103598 |
| **CRS operativo TerraMind** | EPSG:4326 (transformación en importación) |

**Bounding box (EPSG:4326 tras transformación):**

```text
Oeste:  -92.170874
Sur:     13.822903
Este:   -88.224472
Norte:   17.817536
```

## Contenido

| Métrica | Valor |
|---------|-------|
| Registros fuente | 406 |
| Features geográficas únicas | 405 |
| Duplicados exactos descartados | 1 |
| Errores reales de importación | 0 |

**Geometrías reparadas en importación (codigo_g_1):** 11, 21, 33, 87, 0

## Campos

| Campo shapefile | Uso TerraMind |
|-----------------|---------------|
| `codigo_g_1` | `properties.general_code` |
| `codigo_e_2` | `properties.specific_code` |
| `NOMBRE_G_1` | `properties.general_name` |
| `Categor_13` | `properties.general_category` |
| `NOMBRE_e_1` | `properties.specific_name` (nombre preferido si presente) |
| `Categor_14` | `properties.specific_category` (feature_type preferido) |

**Encoding DBF:** UTF-8 (forzado en importador).

## Identificadores

- `logical_area_key` = `codigo_g_1|codigo_e_2|NOMBRE_G_1|NOMBRE_e_1` (normalizado)
- `source_feature_id` = SHA-256(`logical_area_key|geometry_hash`)
- Varios polígonos pueden compartir el mismo `logical_area_key` (fragmentos territoriales).

## Fuente secundaria de control (no operativa)

INAB FeatureServer `SIGAP_12_2021` / capa `SIGAP_05_2022` (mayo 2022, 410 features, EPSG:4326).

Comparación documentada en `INAB-COMPARISON.md` generado por el importador.

## Limitaciones

1. Datos oficiales CONAP; licencia no explícita en el paquete.
2. Algunas áreas tienen múltiples fragmentos poligonales con el mismo código lógico.
3. Un registro anómalo (`codigo_g_1=0`, `NOMBRE_e_1` vacío) — zona de amortiguamiento PNLL.
4. Códigos numéricos CONAP difieren del esquema `SIGAP-NN` usado en la capa INAB 2022.
