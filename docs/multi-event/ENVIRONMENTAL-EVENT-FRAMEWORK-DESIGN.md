# Environmental Event Framework — Multi-Hazard Foundation (Design)

**Fecha:** 2026-07-11
**Base:** `origin/main` (post Thermal module polish)
**Fuente principal:** `docs/multi-event/THERMAL-MODULE-READINESS-AUDIT.md`
**Alcance:** contratos genéricos + registro + adapters térmicos + API genérica de lectura + base frontend + resumen por tipo en Situación Nacional + adapter de informes. **Sin** inundaciones, **sin** Sentinel-1, **sin** migración destructiva.

---

## 1. Principio

TerraMind deja de estar acoplado a actividad térmica: se introduce un modelo canónico `EnvironmentalEvent` y una familia de contratos. Actividad térmica se **envuelve** con adapters; su pipeline físico (`fire_*`, cluster, scheduler) sigue operando sin cambios. Añadir un segundo o tercer evento no exige duplicar la plataforma.

```
FirmsObservationSourceAdapter
  → ThermalObservation
  → ThermalEventDetectorAdapter (envuelve cluster.pipeline)
  → ThermalEventRepositoryAdapter (lee fire_*)
  → EnvironmentalEvent { type: 'thermal_activity' }
  → ThermalEventPresentationAdapter
  → ThermalPointEventMapRenderer
  → ThermalPriorityFactorProvider
```

---

## 2. Mapeo de cada abstracción a archivos reales

| Abstracción nueva | Archivo nuevo | Envuelve / reutiliza (existente) |
| ----------------- | ------------- | -------------------------------- |
| `EnvironmentalEvent` (unión discriminada) | `src/modules/environmental-events/types/environmental-event.types.ts` | `FireEventListItemDto` / `FireEventDetailDto` |
| Taxonomías (status, lifecycle, epistemic, geometry, classification) | `src/modules/environmental-events/types/taxonomy.ts` | `DataClassification` de `executive-metrics/metric-taxonomy.ts` (Phase 1) |
| `EnvironmentalObservation` + `ObservationSourceAdapter` | `types/observation.types.ts` | `FireDetectionGeoJson*`, `firms.config` |
| `EnvironmentalEventDetector` | `contracts/detector.ts` | `cluster.pipeline` (vía adapter server) |
| `EnvironmentalEventRepository` | `contracts/repository.ts` | `fire-events.service`, `fire-event-detail.service`, `findings/priorities/incidents.service` |
| `EnvironmentalEventPresentationAdapter` | `contracts/presentation.ts` | `thermal-labels`, `thermal-event-display`, `fire-interpretation` |
| `EnvironmentalEventMapRenderer` | `contracts/map-renderer.ts` | patrones de `FireEventsMap` (no lo reemplaza) |
| `EnvironmentalFindingRule` + registry | `contracts/finding-rule.ts`, `registry/finding-rule-registry.ts` | perfiles del Composite Finding Engine (no migrado) |
| `EventPriorityFactorProvider` | `contracts/priority-provider.ts` | perfil de prioridad térmico (no recalcula score) |
| `EnvironmentalEventRegistry` | `registry/event-type-registry.ts` | `fire.constants`, labels térmicos |
| Mapper térmico | `thermal/thermal-event.mapper.ts` | DTOs térmicos |
| Query mapper térmico | `thermal/thermal-query.mapper.ts` | `FireEventsQuery` |
| FIRMS source adapter (runtime) | `server/services/environmental-events/firms-source.adapter.ts` | `fire-geojson.service`, `fire-summary.service`, `fire-pipeline-health.service` |
| Thermal detector adapter (runtime) | `server/services/environmental-events/thermal-detector.adapter.ts` | `fire-events.service` (cluster ya ejecutado) |
| Thermal repository adapter (runtime) | `server/services/environmental-events/thermal-event-repository.adapter.ts` | servicios `fire_*` |
| Servicio genérico | `server/services/environmental-events.service.ts` | repository adapter |
| Rutas genéricas | `server/routes/environmental-events.ts` | `runOperationalGuard`, patrón de `fires.ts` |
| API frontend + hooks | `api/environmental-events.api.ts`, `hooks/useEnvironmentalEvents.ts` | `apiClient`, `useAuthQueryReady` |
| Resumen por tipo (Situación Nacional) | `national-situation/event-type-summary.ts` + `getEnvironmentalEventTypeSummaries` | `getFireSummary` |
| Adapter de informes | `reports/thermal-report-section.ts` | `ReportSection` institucional |

---

## 3. Contrato térmico real (del audit) → canónico

| Campo térmico | Campo canónico | Clasificación (audit) |
| ------------- | -------------- | --------------------- |
| `id` | `id` | generic_reusable |
| `status` | `status` (new→detected, active, monitoring, closed→resolved) | generic_reusable (adapter) |
| `validation_status` | `epistemicStatus` (confirmado→verified, resto→inferred) | generic_reusable (adapter) |
| `risk_level` | `severity` (ordinal 1–5) + label | generic_reusable (adapter) |
| `centroid_*`, `geometry_method` | `geometry` (Point) + `attributes.legacy.geometryMethod` | point_geometry_assumption |
| `detection_count`, `satellite_count`, `max_frp_mw`, `source_products` | `attributes` (ThermalEventAttributes) | firms/thermal_specific |
| `persistence_hours` | `persistence` + `attributes.persistenceHours` | generic_reusable |
| `department_*`, `cross_department` | `territory` | generic_reusable |
| `priority_score` | `attributes.legacy.priorityScore` (no recalculado) | safe_to_extract |
| `interpretation`, `evidence_summary` | `summary` (detalle) | thermal_specific (presentation) |
| `*_context` (enrichments) | `detailSectionIds` + repository detail | requires_adapter |

**Campos específicos** viven en `attributes` tipado por tipo (discriminated union), nunca como propiedades sueltas ni `Record<string, unknown>`.

---

## 4. Acoplamientos que permanecen específicos

- **Geometría puntual + clustering:** `ThermalPointEventMapRenderer` sólo declara `point`/`multipoint`. Inundaciones necesitará un `PolygonEventMapRenderer` separado (el contrato ya soporta polígonos).
- **FRP / satélites:** viven en `ThermalEventAttributes` y en reglas `type_specific`.
- **FIRMS:** `FirmsObservationSourceAdapter` es específico; el contrato `ObservationSourceAdapter` es genérico.
- **`fire_*` stores:** intactos; el repository los lee sin migración.

---

## 5. API genérica

| Endpoint | Resuelve |
| -------- | -------- |
| `GET /api/environmental-events` | lista canónica (delegada al repository por tipo) |
| `GET /api/environmental-events/:id` | evento canónico + relaciones (findings/priority/incident) |
| `GET /api/environmental-events/types` | resúmenes por tipo (solo tipos con datos) |

Auth idéntica a térmico: `incidents.view`, `sessionOnly`, `national_scope`, `default_read`. Endpoints `/api/environment/fires/*` y ruta `/incendios` **siguen funcionando**.

---

## 6. Paridad garantizada

`environmental-events.parity.test.ts` + `environmental-events.test.ts` verifican id, geometría, fechas, `detectionCount`, `satelliteCount`, `maxFrp`, persistencia, título determinístico, mapeo de query y conteos de informe. El audit `environmental-event-framework:audit` bloquea regresiones.

---

## 7. Compatibilidad / aliases

| Ruta | Estado |
| ---- | ------ |
| `/incendios`, `/incendios/:id` | específica actual (se mantiene) |
| `/api/environment/fires/*` | legacy activo (se mantiene) |
| `/api/environmental-events/*` | nueva capa genérica (aditiva) |
| `/eventos` | **no creada** (evitaría duplicar UX) |

Futuros aliases: una eventual página `/eventos/:type` podría envolver `/incendios`; se decidirá al implementar el segundo tipo.

---

## 8. Qué falta para Inundaciones (fuera de alcance)

Ver `ADDING-A-NEW-EVENT-TYPE.md`. En resumen: definir `FloodEventAttributes` (ya reservado), registrar `flood`, crear `Sentinel1SourceAdapter` + detector de polígonos, `FloodEventRepositoryAdapter`, `FloodPresentationAdapter`, `PolygonEventMapRenderer`, reglas y priority provider, secciones de detalle y tests. Nada de esto exige tocar actividad térmica.
