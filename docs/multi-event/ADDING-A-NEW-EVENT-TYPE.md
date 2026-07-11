# Cómo agregar un nuevo tipo de evento ambiental

El framework es una **fábrica de eventos plugin-first**. Agregar un tipo = un
manifest + un plugin autocontenido + una ejecución del generador. NO se editan
múltiples registries a mano.

> Regla de oro: el único punto de integración es `event.manifest.ts`. UI, mapa,
> informes y Situación Nacional se alimentan del registro de manifests.

Para el flujo de una sola ejecución con IA, ver
`NEW-EVENT-IMPLEMENTATION-PROMPT.md`. Para las métricas, ver
`ENVIRONMENTAL-EVENT-EXTENSIBILITY-REPORT.md`.

---

## 0. Estructura del plugin

```
src/events/<tipo>/                 (cliente + compartido)
  event.manifest.ts                ← ÚNICO punto de integración
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
  event.detector.ts
  event.test.ts
server/events/<tipo>.server.ts     ← wiring de servidor (repository/detector/fuente)
src/events/specs/<tipo>.event.yaml ← spec declarativa
```

El wiring de servidor se separa por la frontera cliente/servidor del repo
(`tsconfig` excluye `server`), pero es un solo plugin lógico.

## 1. Spec declarativa

Escribe `src/events/specs/<tipo>.event.yaml` (o `.json`). Mínimo: `event`
(type/label/pluralLabel/geometryKinds), y opcional `sources`, `contextLayers`,
`findingRules`, `priorityDimensions`. Ver `flood.event.yaml` como ejemplo.

## 2. Generar el scaffold

```bash
npm run event:new -- --spec src/events/specs/<tipo>.event.yaml
```

Esto:
- crea el plugin completo en `src/events/<tipo>/` (DISABLED);
- crea `server/events/<tipo>.server.ts`;
- parchea por marcadores los dos archivos de tipos centrales (taxonomy + modelo);
- regenera los índices (`manifests.generated.ts`, `server.generated.ts`) vía `event:sync`.

El scaffold **compila**, se **auto-registra deshabilitado** y deja detector/
repository con errores DEV explícitos (sin ciencia falsa).

## 3. Implementar la ciencia real

- `event.types.ts`: atributos tipados del evento.
- `event.detector.ts` / adapters de fuente en `server/`: reutiliza ingesta
  existente; no reescribas. Regístralos en `server/events/<tipo>.server.ts`.
- `event.repository.ts`: lee los stores existentes, sin migración destructiva.
- `event.presentation.ts` / `event.map-renderer.ts` / `event.priority-provider.ts`
  / `event.report-adapter.ts`: copy en español, geometrías reales, factores
  cualitativos (no recalcular score canónico).

## 4. Activar reglas reutilizables

En el manifest, `findingRuleIds: ['EVENT_NEAR_POPULATION', ...]`. Las reglas
genéricas se declaran UNA vez en `finding-rules/reusable-rules.ts` y se activan
por id. Añade `typeSpecificFindingRules` solo para lo propio del tipo.

## 5. Validar y probar

```bash
npm run event:validate -- <tipo>
npm run build
npm run event:test -- <tipo>
npm run environmental-event-framework:audit
```

## 6. Activar en runtime

Cuando la ciencia esté completa, pon `runtime.enabledByDefault: true` (o activa el
feature flag). Situación Nacional, informes, mapa y UI lo mostrarán
automáticamente desde el manifest.

---

### Checklist rápido

```
[ ] spec declarativa (events/specs/<tipo>.event.yaml)
[ ] npm run event:new -- --spec ...
[ ] ciencia real: detector + fuentes + repository
[ ] presentation / map-renderer / priority / report (español, geometrías reales)
[ ] findingRuleIds (reutilizables) + typeSpecific si aplica
[ ] event:validate + build + event:test verdes
[ ] environmental-event-framework:audit verde
[ ] activar feature flag cuando esté validado
```
