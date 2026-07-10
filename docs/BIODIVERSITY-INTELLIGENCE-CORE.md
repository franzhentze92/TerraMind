# Biodiversity Intelligence Core (7C.1)

Módulo reutilizable de biodiversidad para TerraMind. Agrega registros de **GBIF** (colecciones, presencia histórica, agregados institucionales) e **iNaturalist** (observaciones recientes de ciencia ciudadana) sin integrar todavía incendios, clima, cobertura, áreas protegidas, Copilot ni scores.

## Arquitectura

```
src/modules/biodiversity/
  biodiversity.types.ts          # Modelo normalizado
  biodiversity-provider.interface.ts
  biodiversity.service.ts        # Orquestación multi-proveedor
  biodiversity.dto.ts            # Validación API/CLI
  biodiversity-quality.ts
  biodiversity-license.ts
  biodiversity-privacy.ts
  biodiversity-deduplication.ts
  config/biodiversity.config.ts
  providers/gbif/
  providers/inaturalist/
  stores/biodiversity.store.ts   # Stub hasta migración 010
```

Flujo: **DTO → Service → Provider(s) → Mapper → Privacy/License → Dedup → DTO público**

## GBIF vs iNaturalist

| Aspecto | GBIF | iNaturalist |
|---------|------|-------------|
| Naturaleza | Agregador global (museos, ciencia ciudadana, inventarios) | Plataforma de observaciones ciudadanas |
| Autenticación búsqueda | No requerida | No requerida |
| Autenticación bulk | Download API (Basic Auth) | Export / Darwin Core Archive |
| Paginación | `limit` (máx 300) + `offset` (máx 100k profundidad) | `per_page` (máx 200) + `page` (máx ~10k resultados) |
| Rate limits | HTTP 429 bajo carga; sin cuota fija publicada | ~60 req/min recomendado, 100 req/min máx, ~10k req/día |
| Filtro geo | `geometry`, `distanceFromLatitude/Longitude`, país | `lat`, `lng`, `radius` (km) |
| Filtro temporal | `eventDate` (rango) | `d1`, `d2` |
| Licencias | Por dataset/registro (CC, restriccivas, desconocidas) | Por observador (`license_code`) |
| Privacidad | Generalmente coordenadas publicadas; issues de calidad | `geoprivacy`, `obscured`, taxon geoprivacy |
| Sesgo | Sesgo de muestreo institucional / digital | Sesgo de accesibilidad, turismo, taxones visibles |

**No asumir** que todos los registros comparten la misma licencia ni que cubren población actual, abundancia, ausencia o distribución exacta.

## Sesgos y semántica

- `recordKind` distingue observación ciudadana, humana, máquina, espécimen, colección, presencia histórica y observación reciente.
- Pocas observaciones pueden reflejar bajo esfuerzo de muestreo, no ausencia biológica.
- El disclaimer del servicio se incluye en respuestas API/CLI.

## Privacidad

`applyBiodiversityPrivacyPolicy()` aplica niveles:

- `public_exact`
- `public_generalized`
- `sensitive_generalized`
- `private_unavailable`

Reglas: respetar `coordinates_obscured`, no reconstruir ubicaciones ocultas, generalizar coordenadas sensibles (~2 decimales + incertidumbre ≥10 km), retirar coordenadas en `geoprivacy=private`.

## Licencias

`evaluateOccurrenceLicense()` por ocurrencia:

- Atribución y `source_url` obligatorias en DTO.
- Licencia desconocida → warning `unknown_license`.
- Medios no se descargan; warning `media_license_not_verified` si el registro referencia fotos/audios.

## Deduplicación (7C.1.1)

Niveles de confianza:

| Nivel | Comportamiento |
|-------|----------------|
| `exact` / `high` | `possibleDuplicate=true`, `duplicateGroupId` asignado |
| `medium` / `low` | `duplicateCandidate=true`, sin agrupación automática |

Reglas:

- **Seguro:** ID iNaturalist compartido, `occurrenceID`, URL iNat en GBIF, referencia compatible
- **Probable:** taxón + fecha precisa + coords dentro de tolerancia + procedencia iNat en GBIF
- **No fusionar:** misma especie y fecha sin evidencia de origen compartido; coords oscurecidas; fechas imprecisas (año/mes)

Los registros GBIF del dataset iNaturalist **no** se marcan como duplicados entre sí solo por compartir dataset.

Procedencia GBIF→iNaturalist: `detectGbifInaturalistProvenance()` (dataset, organización, occurrenceID, references, URL).

## Revisión QA

Regenerar evidencia de revisión (salida local, no commitear):

```bash
mkdir -p artifacts/review
npx tsx scripts/biodiversity-final-review.ts > artifacts/review/review-output.json
```

Ejemplo sanitizado: `docs/biodiversity-review-output.example.json`

## Caché

Variables de entorno:

| Variable | Default |
|----------|---------|
| `GBIF_SEARCH_TTL_HOURS` | 24 |
| `INATURALIST_SEARCH_TTL_HOURS` | 2 |
| `BIODIVERSITY_TAXON_TTL_DAYS` | 7 |
| `BIODIVERSITY_HEALTH_TTL_MINUTES` | 15 |

Hash determinístico: proveedor + geometría + taxón + fechas + filtros + página (`utils/query-hash.ts`).

## API (preparada, no montada)

Rutas en `server/routes/biodiversity.ts` — **no registradas** en `server/index.ts`.

### Pendiente antes de montaje

- **Rate limiting** en middleware servidor (cliente ya tiene retry/backoff)
- **Autenticación** obligatoria (mismo patrón que `/api/environment/fires`)
- Sin exposición pública anónima

### Límites ya validados (Zod)

- Radio máx **50 km** (`radius_m`)
- `limit` máx **200**
- Fechas ISO o `YYYY-MM-DD`
- Sin geometrías complejas ni consultas nacionales masivas
- `provider=all` con deduplicación multi-fuente

### Modos de respuesta

| Modo | Uso | Contenido |
|------|-----|-----------|
| `summary` | **Preferido para frontend** | Agregados + items sin coordenadas |
| `detail` | Uso restringido / auditoría | Items con coordenadas solo si `privacy_level=public_exact` |

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/environment/biodiversity/search` | Búsqueda por lat/lng/radio |
| GET | `/api/environment/biodiversity/taxa/resolve` | Resolución taxonómica |
| GET | `/api/environment/biodiversity/health` | Salud del subsistema |

## CLI

```bash
npm run biodiversity:search -- --lat=17.5 --lng=-90.0 --radius=10000 --limit=30
npm run biodiversity:taxon -- --name="Panthera onca"
npm run biodiversity:status
```

## Resiliencia

- `BIODIVERSITY_USER_AGENT` identificable
- `BIODIVERSITY_REQUEST_TIMEOUT_MS` (default 20s)
- `BIODIVERSITY_MAX_CONCURRENCY` (default 3)
- Retry con backoff solo en errores transitorios (429, 5xx, red)
- `AbortController` + timeout por request
- Logs sin payloads completos en DTO público

## Almacenamiento propuesto

Migración **`010_biodiversity_intelligence_core.sql`** (NO aplicada):

- `biodiversity_sources`
- `biodiversity_taxa`
- `biodiversity_occurrences`
- `biodiversity_fetch_runs`

## Extracción masiva

Para volúmenes nacionales o >100k registros GBIF: usar **GBIF Download API** (autenticada). Para iNaturalist: export o Darwin Core Archive en GBIF (`50c9509d-22c7-4a22-a47d-8c48425ef4a7`). No implementado en 7C.1.

## Futura integración

- CONAP (listas nacionales, áreas)
- CITES (comercio especies)
- UICN (estatus conservación en `biodiversity_taxa.conservation_statuses`)
- eBird (aves, otro proveedor)

## Referencias oficiales

- GBIF API: https://techdocs.gbif.org/en/openapi/
- GBIF Occurrence: https://techdocs.gbif.org/en/openapi/v1/occurrence
- GBIF Species: https://techdocs.gbif.org/en/openapi/v1/species
- GBIF Terms: https://www.gbif.org/terms
- iNaturalist API: https://api.inaturalist.org/v1/docs/
- iNaturalist Recommended Practices: https://www.inaturalist.org/pages/api+recommended+practices
