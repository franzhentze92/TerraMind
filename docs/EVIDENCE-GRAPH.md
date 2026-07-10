# Evidence Graph — TerraMind

**Versión:** 1.0  
**Rol:** Trazabilidad total — cada conclusión es auditable  
**Principio:** No es una base de datos relacional. Es un grafo de conocimiento.

---

## 1. Por qué un grafo

Una base de datos responde: "¿Qué hallazgos hay?"

Un Evidence Graph responde: **"¿Por qué existe este hallazgo y qué lo respalda?"**

```
Hallazgo #2026-000143
  └── se basa en → Evento "ndvi_drop"
        └── proviene de → Observación (Sentinel, NDVI=0.38)
              └── proveniente de → Fuente "sentinel-2"
  └── respaldado por → Evidencia #E-001
        └── contiene → Observación (CHIRPS, rainfall=-42%)
  └── explicado por → Hipótesis "Estrés hídrico"
        └── confirmada por → Evidencia #E-001, #E-002, #E-003
  └── genera → Estrategia "Validar en campo"
  └── documentado en → Expediente #2026-000143
```

---

## 2. Modelo del grafo

### Vértices (nodos)

| Tipo | ID prefix | Ejemplo |
|------|-----------|---------|
| `fuente` | `src:` | `src:sentinel-2` |
| `variable` | `var:` | `var:ndvi` |
| `observacion` | `obs:` | `obs:sentinel-2:GT-16:ndvi:2026-07-09` |
| `evento` | `evt:` | `evt:ndvi_drop:2026-0001` |
| `hallazgo` | `hal:` | `hal:2026-000143` |
| `hipotesis` | `hip:` | `hip:001:hal:2026-000143` |
| `evidencia` | `evd:` | `evd:001:hal:2026-000143` |
| `riesgo` | `rsk:` | `rsk:hal:2026-000143` |
| `prioridad` | `pri:` | `pri:hal:2026-000143` |
| `estrategia` | `str:` | `str:001:hal:2026-000143` |
| `escenario` | `esc:` | `esc:001:hal:2026-000143` |
| `expediente` | `exp:` | `exp:2026-000143` |
| `reporte` | `rep:` | `rep:2026-07-09` |
| `regla` | `reg:` | `reg:R-COR-001` |

### Aristas (relaciones)

| Relación | De → A | Metadata |
|----------|--------|----------|
| `produce` | fuente → observacion | timestamp, latencia |
| `mide` | observacion → variable | valor, unidad |
| `ubicada_en` | observacion → territorio | — |
| `dispara` | observacion → evento | reglaId, desviacion |
| `compone` | evento → hallazgo | peso, orden |
| `respalda` | evidencia → hallazgo | tipo (a_favor/en_contra), peso |
| `soporta` | evidencia → hipotesis | tipo, peso |
| `explica` | hipotesis → hallazgo | confianza |
| `evalua` | riesgo → hallazgo | nivel |
| `prioriza` | prioridad → hallazgo | score |
| `recomienda` | estrategia → hallazgo | horizonte |
| `proyecta` | escenario → hallazgo | horizonte, confianza |
| `documenta` | expediente → hallazgo | 1:1 |
| `compila` | reporte → hallazgo | orden |
| `generada_por` | evento → regla | version |
| `contiene` | evidencia → observacion | — |
| `contradice` | evidencia → hipotesis | fuerza |

---

## 3. Esquema TypeScript

```typescript
interface GraphNode {
  id: string
  type: GraphNodeType
  entityId: string
  label: string
  metadata: Record<string, unknown>
  createdAt: string
}

interface GraphEdge {
  id: string
  source: string    // node id
  target: string    // node id
  relation: GraphRelation
  weight?: number   // 0-100
  metadata: Record<string, unknown>
  createdAt: string
}

interface EvidenceGraph {
  nodes: Map<string, GraphNode>
  edges: Map<string, GraphEdge>

  addNode(node: GraphNode): void
  addEdge(edge: GraphEdge): void
  getPath(fromId: string, toId: string): GraphPath
  getAncestors(nodeId: string): GraphNode[]
  getDescendants(nodeId: string): GraphNode[]
  traceConclusion(hallazgoId: string): ConclusionTrace
}
```

---

## 4. ConclusionTrace — "¿Por qué dijiste eso?"

La operación más importante del grafo:

```typescript
interface ConclusionTrace {
  hallazgo: GraphNode
  expediente: GraphNode

  cadena: {
    observaciones: TracedNode[]
    eventos: TracedNode[]
    evidenciaAFavor: TracedNode[]
    evidenciaEnContra: TracedNode[]
    hipotesis: TracedNode[]
    fuentes: TracedNode[]
    reglas: TracedNode[]
  }

  confianza: ConfidenceResult
  explicacion: string
}

interface TracedNode {
  node: GraphNode
  path: GraphEdge[]    // camino desde el hallazgo
  depth: number
}
```

**Uso:** Cuando un ministro pregunta "¿por qué dijeron esto?", el sistema ejecuta `traceConclusion(hallazgoId)` y produce el árbol completo de evidencia.

---

## 5. Construcción del grafo

El grafo se construye **durante** el Reasoning Pipeline, no después:

| Etapa | Nodos añadidos | Aristas añadidas |
|-------|----------------|------------------|
| Observar | observacion, fuente, variable | produce, mide |
| Correlacionar | evento, hallazgo, expediente | dispara, compone, documenta |
| Hipótesis | hipotesis | explica |
| Evidencia+/- | evidencia | respalda, soporta, contradice, contiene |
| Confianza | — | metadata en nodos existentes |
| Priorizar | prioridad, riesgo | prioriza, evalua |
| Escenarios | escenario | proyecta |
| Estrategias | estrategia | recomienda |
| Reporte | reporte | compila |

---

## 6. Persistencia

| Opción | Pros | Contras |
|--------|------|---------|
| PostgreSQL + tablas de aristas | Familiar, SQL | Queries de path complejas |
| Neo4j | Nativo para grafos | Infra adicional |
| PostgreSQL + JSONB paths | Simple, un solo DB | Menos flexible |
| **Recomendación MVP** | **PostgreSQL con tablas `graph_nodes` + `graph_edges`** | Balance ideal |

---

## 7. Queries fundamentales

```sql
-- Todos los ancestros de un hallazgo (¿de dónde viene?)
WITH RECURSIVE ancestors AS (
  SELECT source, target, relation, 1 as depth
  FROM graph_edges WHERE target = $hallazgoNodeId
  UNION ALL
  SELECT e.source, e.target, e.relation, a.depth + 1
  FROM graph_edges e JOIN ancestors a ON e.target = a.source
  WHERE a.depth < 10
)
SELECT * FROM ancestors;

-- Fuentes que respaldan un hallazgo
SELECT DISTINCT n.* FROM graph_nodes n
JOIN graph_edges e ON n.id = e.source
WHERE e.target = $hallazgoNodeId
  AND e.relation IN ('respalda', 'contiene', 'produce')
  AND n.type = 'fuente';
```

---

*Evidence Graph v1.0 — La columna vertebral de la trazabilidad.*
