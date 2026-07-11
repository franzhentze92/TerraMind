# Plantilla de prompt — implementar un evento en UNA sola ejecución

Copia este prompt, rellena las variables `{{...}}` y pégalo a Cursor. El objetivo
es obtener un plugin de evento **completo, autocontenido e integrado** en una sola
corrida, sin rediseñar arquitectura.

> Arquitectura ya existente (no rediseñar): manifest único
> (`defineEnvironmentalEvent`), plugin-first en `src/events/<tipo>/` + wiring de
> servidor en `server/events/<tipo>.server.ts`, auto-registro por índices
> generados (`npm run event:sync`), reglas reutilizables por id, UI/mapa/informes
> /Situación Nacional alimentados desde el manifest. Solo hay que aportar ciencia,
> fuentes y reglas.

---

## Variables

- Nombre visible: `{{label}}` (plural: `{{pluralLabel}}`)
- Tipo (snake_case): `{{type}}`
- Geometría: `{{geometryKinds}}` (p. ej. `polygon,multipolygon`)
- Icono: `{{icon}}`
- Fuentes: `{{sources}}` (p. ej. `sentinel_1,chirps`)
- Algoritmo de detección: `{{algorithm}}`
- Reglas reutilizables a activar: `{{findingRules}}`
  (`EVENT_NEAR_POPULATION`, `EVENT_NEAR_ROAD`, `EVENT_INSIDE_CROPLAND`, …)
- Factores de prioridad: `{{priorityDimensions}}`
- Capas territoriales: `{{contextLayers}}`
- Metodología: `{{methodology}}`
- Limitaciones: `{{limitations}}`
- Feature flag: `{{featureFlag}}`

---

## Prompt

```text
Implementa el evento "{{label}}" ({{type}}) como un plugin autocontenido, en una
sola ejecución, SIN modificar manualmente módulos centrales más allá de los dos
archivos de tipos permitidos (taxonomy + modelo), que el generador ya parchea.

Sigue exactamente este orden:

1. Crear spec declarativa:
   Escribe `src/events/specs/{{type}}.event.yaml` con event/sources/contextLayers/
   findingRules/priorityDimensions según las variables.

2. Ejecutar scaffold:
   npm run event:new -- --spec src/events/specs/{{type}}.event.yaml
   (Genera el plugin en DISABLED, con detector/repository lanzando errores DEV.)

3. Implementar el plugin (src/events/{{type-folder}}/):
   - event.types.ts: atributos tipados reales del evento.
   - event.presentation.ts: etiquetas y métricas en español.
   - event.map-renderer.ts: feature/leyenda/popup para {{geometryKinds}}.
   - event.priority-provider.ts: factores cualitativos {{priorityDimensions}}.
   - event.report-adapter.ts: sección institucional real.
   - event.methodology.ts / event.limitations.ts: {{methodology}} / {{limitations}}.

4. Conectar fuentes:
   Implementa los adapters de {{sources}} en server/ (reutiliza ingesta existente,
   no reescribas). Regístralos en server/events/{{type-folder}}.server.ts.

5. Implementar detector:
   Sustituye los errores DEV por el algoritmo real: {{algorithm}}. No inventes
   ciencia; documenta supuestos y limitaciones.

6. Activar reglas:
   En el manifest, `findingRuleIds: [{{findingRules}}]`. Añade reglas específicas
   del tipo solo si no existen como reutilizables.

7. Conectar prioridad:
   Cablea event.priority-provider a las dimensiones {{priorityDimensions}} sin
   recalcular el score canónico.

8. Conectar mapa:
   Verifica que el renderer soporta {{geometryKinds}} y que la UI genérica
   (GenericEventCard/Detail, buildEventLegend/Popup) lo muestra sin cambios
   centrales.

9. Conectar informes:
   El report-adapter debe entrar automáticamente al catálogo
   (environmentalEventRegistry.reportAdapterCatalog()).

10. Validar:
    npm run event:validate -- {{type}}
    npm run build

11. Probar:
    npm run event:test -- {{type}}
    npm run environmental-event-framework:audit

12. Commit y push (solo tras aprobación):
    Activa el feature flag {{featureFlag}} únicamente cuando la ciencia esté
    completa y validada.

Restricciones:
- No edites Situación Nacional, informes, mapa nacional ni la API genérica.
- El único punto de integración es el manifest.
- Si algo no puede implementarse de forma genérica sin alterar resultados
  existentes, crea el contrato y documenta la limitación.
```
