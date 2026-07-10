# TerraMind — Documentación fundacional

## Constitución del producto

| # | Documento | Qué define |
|---|-----------|------------|
| 1 | [TERRAMIND-PRD.md](./TERRAMIND-PRD.md) | Misión, visión, arquitectura, roadmap |
| 2 | [ONTOLOGY.md](./ONTOLOGY.md) | Modelo del mundo — entidades, relaciones, flujos |
| 3 | [BRAIN-SPEC.md](./BRAIN-SPEC.md) | **Especificación técnica del cerebro** |

## El cerebro (propiedad intelectual)

| # | Documento | Qué define | Código |
|---|-----------|------------|--------|
| 4 | [REASONING-FRAMEWORK.md](./REASONING-FRAMEWORK.md) | 12 etapas de razonamiento | `src/engine/reasoning/` |
| 5 | [EVIDENCE-GRAPH.md](./EVIDENCE-GRAPH.md) | Grafo de trazabilidad | `src/engine/evidence-graph/` |
| 6 | [CONFIDENCE-SYSTEM.md](./CONFIDENCE-SYSTEM.md) | Cálculo de confianza explicable | `src/engine/confidence/` |
| 7 | [HYPOTHESIS-LIBRARY.md](./HYPOTHESIS-LIBRARY.md) | Biblioteca de hipótesis | `src/engine/libraries/` |
| 8 | [STRATEGY-LIBRARY.md](./STRATEGY-LIBRARY.md) | Biblioteca de estrategias | `src/engine/libraries/` |
| 9 | [KNOWLEDGE-PACK.md](./KNOWLEDGE-PACK.md) | Conocimiento estructurado | `src/engine/knowledge-pack/` |
| 10 | [ANALYST-MANUAL.md](./ANALYST-MANUAL.md) | Personalidad científica | — |

## Conocimiento operativo

| # | Documento | Qué define | Código |
|---|-----------|------------|--------|
| 11 | [VARIABLE-CATALOG.md](./VARIABLE-CATALOG.md) | Vocabulario semántico | `src/ontology/catalog/` |
| 12 | [RULE-BOOK.md](./RULE-BOOK.md) | Conocimiento experto codificado | `src/ontology/rule-engine/` |

## Código

```
src/ontology/     → Qué existe en el mundo (entidades)
src/engine/       → Cómo piensa el sistema (cerebro)
src/modules/      → Cómo se presenta (UI — Equipo 4)
src/sources/      → De dónde vienen los datos (Equipo 2)
```

## Los cuatro equipos

| Equipo | Estado | Artefacto |
|--------|--------|-----------|
| 1. Ontology + Brain | ✅ Completo | `src/ontology/` + `src/engine/` + `docs/` |
| 2. Data Engine | Pendiente | Pipeline + conectores |
| 3. Reasoning Engine (runtime) | Pendiente | Implementación de las 12 etapas |
| 4. Experience | Prototipo | Frontend |

## Regla de oro

> Si una funcionalidad no produce, consume o enriquece un **Hallazgo** con **Expediente** respaldado por el **Evidence Graph**, no pertenece al motor.
