# Reporte de extensibilidad — Environmental Event Framework

Mide cuánto cuesta agregar un evento nuevo. Objetivo: **un prompt, una ejecución,
un plugin autocontenido**, con integración automática de UI, mapa, informes y
Situación Nacional desde un único manifest.

## Objetivo obligatorio

| Criterio | Meta | Estado |
|---|---|---|
| Archivos centrales modificados manualmente | 0–2 | ✅ 2 (solo tipos) |
| Cambios manuales en Situación Nacional | 0 | ✅ 0 |
| Cambios manuales en informes | 0 | ✅ 0 |
| Cambios manuales en mapa nacional | 0 | ✅ 0 |
| Cambios manuales en API genérica | 0 | ✅ 0 |
| Punto de integración | 1 manifest | ✅ `event.manifest.ts` |

Los dos archivos centrales son declaraciones de tipos, y el generador los parchea
por marcadores (`event:new:*`), no a mano:

- `src/modules/environmental-events/types/taxonomy.ts` (miembro de la unión + type guard)
- `src/modules/environmental-events/types/environmental-event.types.ts` (atributos + unión)

## Demostración con `synthetic_framework_test`

El plugin sintético (deshabilitado, solo pruebas) demuestra el flujo completo.

### Archivos del plugin creados

```
src/events/synthetic-framework-test/
  event.types.ts
  event.presentation.ts
  event.map-renderer.ts
  event.priority-provider.ts
  event.finding-rules.ts
  event.report-adapter.ts
  event.methodology.ts
  event.limitations.ts
  event.detail-sections.ts
  event.sources.ts
  event.repository.ts
  event.manifest.ts        ← único punto de integración
  event.test.ts
server/events/synthetic-framework-test.server.ts   ← wiring de servidor
```

### Archivos centrales modificados manualmente

- `taxonomy.ts` y `environmental-event.types.ts` (solo tipos). **Total: 2.**

### Índices regenerados por herramienta (no manuales)

- `src/events/manifests.generated.ts`
- `server/events/server.generated.ts`

### Comandos ejecutados

```bash
npm run event:new -- --spec src/events/specs/<tipo>.event.yaml   # scaffold + patch + sync
npm run event:validate -- <tipo>
npm run event:test -- <tipo>
npm run build
npm run environmental-event-framework:audit
```

### Pasos manuales

1. Escribir la spec declarativa.
2. Ejecutar `event:new`.
3. Implementar ciencia real (detector, repository, fuentes).
4. Validar, probar, commitear.

Ninguno toca Situación Nacional, informes, mapa nacional ni la API genérica: todos
leen del registro de manifests.

## Cómo se autodetecta

- **Registry**: `ensureEventsRegistered()` recorre `ALL_EVENT_MANIFESTS` (índice generado).
- **API `/types`**: `environmentalEventRegistry.enabledTypes()` (oculta deshabilitados).
- **Situación Nacional**: `getEnvironmentalEventTypeSummaries()` itera `listEnabled()` + `repo.summarize()`.
- **Informes**: `reportAdapterCatalog()`.
- **Mapa**: `mapRendererCatalog()` + `buildEventLegend/Popup`.
- **UI**: `buildEventCardModel` / `buildEventDetailModel` / `GenericEventCard` / `GenericEventDetail`.

El audit `environmental-event-framework:audit` falla si estos índices se
desincronizan, si faltan los comandos, si el sintético no se autodetecta, o si más
de dos archivos centrales referencian un tipo de plugin.

## Cómo sería exactamente el único prompt/run para Inundaciones

1. `src/events/specs/flood.event.yaml` ya existe como ejemplo (polygon/multipolygon,
   `sentinel_1`+`chirps`, reglas `EVENT_NEAR_POPULATION`/`EVENT_NEAR_ROAD`/
   `EVENT_INSIDE_CROPLAND`, prioridad severity=`flooded_area,expansion_rate`).
2. `npm run event:new -- --spec src/events/specs/flood.event.yaml`
3. Implementar detector real (Sentinel-1 SAR), repository y adapters de fuente.
4. `npm run event:validate -- flood` → `npm run event:test -- flood` → `npm run build`.
5. Activar `featureFlag: flood` cuando la ciencia esté validada.

Ver `NEW-EVENT-IMPLEMENTATION-PROMPT.md` para el prompt completo.

## Limitaciones reales actuales

- Las reglas territoriales reutilizables (`EVENT_NEAR_POPULATION`, `NEAR_ROAD`,
  `INSIDE_CROPLAND`, `NEAR_PROTECTED_AREA`, `WITH_BIODIVERSITY_CONTEXT`) están como
  **contrato**: evalúan `matched:false` con racional documentado hasta cablear el
  enriquecimiento territorial genérico, para no alterar resultados térmicos.
- El wiring de servidor vive en `server/events/<tipo>.server.ts` (no dentro de
  `src/events/<tipo>/`) por la frontera cliente/servidor del repo (`tsconfig`
  excluye `server`). Sigue siendo un solo plugin lógico.
- El scaffold del generador deja detector/repository con errores DEV explícitos;
  la ciencia real es responsabilidad de cada evento.
