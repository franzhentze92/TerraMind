# TerraMind Ontology

**Versión:** 1.0  
**Estado:** Modelo conceptual fundacional  
**Relación:** Extiende y operacionaliza `TERRAMIND-PRD.md`

---

## 1. Qué es la Ontology

La Ontology de TerraMind es el **modelo del mundo** — el framework de pensamiento que define qué existe, cómo se relaciona y cómo evoluciona dentro del sistema.

| Empresa | Ontology |
|---------|----------|
| Palantir | Ontology Objects |
| Bloomberg | Entidades financieras |
| Salesforce | Account, Opportunity, Contact |
| **TerraMind** | **Territorio → Observación → … → Reporte** |

Sin Ontology, TerraMind es un dashboard. Con Ontology, es un motor de inteligencia.

---

## 2. Las diez entidades

```
Territorio
    ↓ contiene
Observación ──→ Evento ──→ Hallazgo ──→ Estrategia ──→ Reporte
                  ↑            ↑  ↑
              Variable      Hipótesis
                            Evidencia
                            Riesgo
                            Prioridad
                            Expediente
```

### Mapa de entidades

| Entidad | Naturaleza | Pregunta que responde |
|---------|------------|----------------------|
| **Territorio** | Contexto espacial | ¿Dónde? |
| **Observación** | Dato crudo normalizado | ¿Qué se midió? |
| **Evento** | Señal relevante | ¿Qué cambió? |
| **Hallazgo** | Inteligencia sintetizada | ¿Qué significa? |
| **Hipótesis** | Explicación causal | ¿Por qué? |
| **Evidencia** | Soporte verificable | ¿Con qué lo demuestras? |
| **Riesgo** | Evaluación de impacto | ¿Qué tan grave? |
| **Prioridad** | Urgencia ejecutiva | ¿Qué primero? |
| **Estrategia** | Acción recomendada | ¿Qué hacer? |
| **Reporte** | Síntesis periódica | ¿Cuál es el panorama? |

### Entidades de soporte

| Entidad | Rol |
|---------|-----|
| **Variable** | Definición semántica de qué se mide (Catálogo Nacional) |
| **Fuente** | Origen de datos y su conector |
| **Expediente** | Caso de investigación completo de un Hallazgo |
| **Regla** | Conocimiento experto codificado (Libro de Reglas) |

---

## 3. Entidades en detalle

### 3.1 Territorio

El contexto espacial y administrativo donde opera el sistema.

```
Territorio {
  id: string                    // "GT", "GT-16" (Petén)
  nombre: string                // "Guatemala", "Petén"
  tipo: pais | departamento | municipio | cuenca | corredor | custom
  codigo: string                // ISO 3166, código interno
  padreId?: string              // Jerarquía territorial
  geometria?: Geometry
  timezone: string
  metadata: {
    poblacion?: number
    areaKm2?: number
    sectoresPrioritarios?: string[]
  }
}
```

**Relaciones:**
- `contiene` → Observaciones, Eventos, Hallazgos
- `padre` → Territorio (jerarquía)

**Ejemplo:**
```
id: "GT-16"
nombre: "Petén"
tipo: departamento
padreId: "GT"
```

---

### 3.2 Observación

Un dato crudo normalizado. Nada más.

```
Observación {
  id: string                    // Determinístico: source+time+location+variable
  variableId: string            // Referencia al Catálogo Nacional
  fuenteId: string
  territorioId: string
  timestamp: datetime
  ingestedAt: datetime

  valor: number | string | boolean
  unidad: string
  ubicacion: GeoLocation
  geometria?: Geometry

  calidad: 0-100
  flags: string[]               // "cloud_cover", "stale", "interpolated"
  referenciaRaw: string         // URL, tile ID, archivo
  metadata: object
}
```

**Reglas:**
- Una Observación nunca se modifica después de persistirse
- Una Observación nunca es inteligencia — es materia prima
- Una Observación siempre referencia una Variable del catálogo

**Ejemplo:**
```
variableId: "ndvi"
fuenteId: "sentinel-2"
valor: 0.54
territorioId: "GT-16"
timestamp: "2026-07-09T14:00:00Z"
```

---

### 3.3 Evento

Una Observación (o conjunto) que cruzó un umbral de relevancia.

```
Evento {
  id: string
  tipo: string                  // "ndvi_drop", "fire_detected", "temp_anomaly"
  territorioId: string
  detectadoEn: datetime

  // Qué lo disparó
  observacionIds: string[]
  variableId: string
  valorObservado: number
  valorEsperado?: number        // Baseline
  desviacion?: number          // % o sigma

  severidad: leve | moderada | significativa | critica
  reglaId: string               // Qué regla lo detectó
  estado: detectado | correlacionando | asociado | descartado

  metadata: object
}
```

**Ciclo de vida:**
```
detectado → correlacionando → asociado (a Hallazgo) | descartado
```

**Ejemplo:**
```
tipo: "ndvi_drop"
variableId: "ndvi"
valorObservado: 0.42
valorEsperado: 0.54
desviacion: -12%
severidad: significativa
territorioId: "GT-16"
```

---

### 3.4 Hallazgo ⭐ (átomo del sistema)

Inteligencia sintetizada a partir de múltiples Eventos.

```
Hallazgo {
  id: string                    // "2026-000143"
  codigo: string                // Formato: YYYY-NNNNNN
  titulo: string
  descripcion: string
  categoria: climatico | hidrologico | vegetacion | incendio | suelo | institucional | compuesto

  territorioId: string
  ubicacion: GeoLocation
  detectadoEn: datetime
  actualizadoEn: datetime

  estado: detectado | en_investigacion | confirmado | priorizado | en_seguimiento | resuelto | descartado
  prioridadId?: string
  riesgoId?: string

  // Relaciones
  eventoIds: string[]
  hipotesisIds: string[]
  evidenciaIds: string[]
  estrategiaIds: string[]
  expedienteId: string          // Siempre existe — 1:1

  // Métricas
  confianza: 0-100
  observacionCount: number
  eventoCount: number

  // Versionado
  version: number
  versionMotor: string
}
```

**Ciclo de vida:**
```
detectado
  → en_investigacion    (agregando evidencia)
  → confirmado          (múltiples fuentes corroboran)
  → priorizado          (Priority Engine asignó urgencia)
  → en_seguimiento      (monitoreo activo)
  → resuelto | descartado
```

**Ejemplo:**
```
codigo: "2026-000143"
titulo: "Deterioro acelerado del corredor seco"
categoria: compuesto
estado: en_investigacion
confianza: 87
eventoIds: ["evt-001", "evt-002", "evt-003"]
```

---

### 3.5 Hipótesis

Explicación causal propuesta para un Hallazgo.

```
Hipótesis {
  id: string
  hallazgoId: string
  afirmacion: string            // "La causa más probable es estrés hídrico"
  confianza: 0-100
  estado: propuesta | activa | confirmada | refutada | descartada

  // Soporte
  evidenciaAFavor: string[]     // Evidence IDs
  evidenciaEnContra: string[]   // Evidence IDs
  reglaId?: string              // Regla que la generó

  generadaEn: datetime
  evaluadaEn?: datetime
  razonDescarte?: string
}
```

**Reglas:**
- Un Hallazgo puede tener múltiples Hipótesis
- Solo una puede ser `confirmada` a la vez
- Una Hipótesis `refutada` nunca se elimina — queda en el expediente

**Ejemplo:**
```
afirmacion: "Estrés hídrico prolongado como causa del deterioro vegetativo"
confianza: 82
estado: confirmada
```

---

### 3.6 Evidencia

Una Observación o conjunto seleccionado para respaldar o contradecir una Hipótesis o Hallazgo.

```
Evidencia {
  id: string
  tipo: a_favor | en_contra | neutral
  hallazgoId: string
  hipotesisId?: string

  // Origen
  observacionIds: string[]
  eventoIds: string[]
  fuenteIds: string[]
  variableIds: string[]

  // Contenido
  resumen: string
  peso: 0-100                 // Contribución a la confianza
  confianza: 0-100

  generadaEn: datetime
  generadaPor: motor | analista | regla
}
```

**Regla sagrada:**
> Ningún Hallazgo visible al usuario existe sin al menos una Evidencia `a_favor`.

---

### 3.7 Riesgo

Evaluación de impacto potencial de un Hallazgo.

```
Riesgo {
  id: string
  hallazgoId: string
  nivel: bajo | medio | alto | critico
  impacto: {
    territorial: string         // "8 departamentos"
    poblacion?: number
    economico?: string          // "240,000 ha en zona de riesgo"
    ambiental?: string
    institucional?: string
  }
  horizonte: inmediato | corto_plazo | mediano_plazo | largo_plazo
  evaluadoEn: datetime
  evaluadoPor: motor | regla
}
```

---

### 3.8 Prioridad

Urgencia ejecutiva asignada a un Hallazgo.

```
Prioridad {
  id: string
  hallazgoId: string
  nivel: baja | media | alta | critica
  score: 0-100                // impacto × urgencia × confianza
  razon: string
  asignadaEn: datetime
  asignadaPor: motor | analista
  revisarEn?: datetime
}
```

**Fórmula conceptual:**
```
score = (impacto × 0.4) + (urgencia × 0.35) + (confianza × 0.25)
```

---

### 3.9 Estrategia

Acción recomendada derivada de un Hallazgo priorizado.

```
Estrategia {
  id: string
  hallazgoId: string
  titulo: string
  descripcion: string
  acciones: string[]            // ["Validar en campo", "Monitorear", "Actualizar en 48h"]
  rationale: string
  confianza: 0-100
  prioridad: baja | media | alta | critica
  horizonte: inmediato | corto_plazo | mediano_plazo | largo_plazo
  responsableSugerido?: string
  estado: propuesta | aceptada | en_ejecucion | completada | rechazada
  generadaEn: datetime
}
```

**Regla:**
> Una Estrategia nunca se genera sin un Hallazgo padre con estado `confirmado` o `priorizado`.

---

### 3.10 Reporte

Síntesis periódica que compila Hallazgos para responder las 5 preguntas estratégicas.

```
Reporte {
  id: string
  tipo: diario | semanal | mensual | especial
  territorioId: string
  periodo: { inicio: datetime, fin: datetime }
  generadoEn: datetime

  // Las 5 preguntas
  respuestas: {
    queEstaPasando: HallazgoRef[]
    porQue: HipotesisRef[]
    quePuedePasar: ProyeccionRef[]
    queMereceAtencion: PrioridadRef[]
    queEstrategias: EstrategiaRef[]
  }

  hallazgoIds: string[]
  resumenEjecutivo?: string    // Generado por IA (Fase 4)
  confianzaGlobal: 0-100
}
```

---

### 3.11 Expediente ⭐ (el verdadero producto)

Caso de investigación completo de un Hallazgo. Lo que un ministro abre cuando quiere entender.

```
Expediente {
  id: string
  hallazgoId: string            // 1:1
  codigo: string                // "2026-000143"

  // Estado del caso
  estado: abierto | en_investigacion | pendiente_validacion | cerrado
  aperturadoEn: datetime
  cerradoEn?: datetime

  // Inventario
  observacionCount: number
  eventoCount: number
  hipotesisCount: number
  evidenciaAFavorCount: number
  evidenciaEnContraCount: number

  // Inteligencia actual
  hipotesisPrincipalId?: string
  confianzaActual: 0-100
  fuentesUtilizadas: string[]

  // Programación
  proximaActualizacion: datetime
  frecuenciaMonitoreo: string   // "6h", "24h", "7d"

  // Historial
  historial: ExpedienteEvent[]

  // Resumen para ejecutivo (IA, Fase 4)
  resumenEjecutivo?: string
}
```

**Ejemplo visual:**
```
Expediente #2026-000143
Estado: 🟠 En investigación
Territorio: Corredor Seco
Observaciones: 127
Eventos: 8
Hipótesis: 3 (principal: Estrés hídrico, 87%)
Fuentes: Sentinel-2, CHIRPS, ERA5, NASA FIRMS, INSIVUMEH
Evidencia a favor: 5 | en contra: 1
Próxima actualización: Mañana 06:00
```

---

## 4. Relaciones entre entidades

```
Territorio 1──* Observación
Territorio 1──* Evento
Territorio 1──* Hallazgo
Territorio 1──* Reporte

Variable 1──* Observación
Fuente 1──* Observación

Observación *──* Evento          (via observacionIds)
Evento *──* Hallazgo             (via eventoIds)

Hallazgo 1──1 Expediente
Hallazgo 1──* Hipótesis
Hallazgo 1──* Evidencia
Hallazgo 0──1 Riesgo
Hallazgo 0──1 Prioridad
Hallazgo 1──* Estrategia

Hipótesis *──* Evidencia         (a favor / en contra)
Regla 1──* Evento                (via reglaId)
Regla 1──* Hipótesis             (via reglaId)

Reporte *──* Hallazgo
```

### Diagrama ER simplificado

```
┌──────────┐     ┌─────────────┐     ┌────────┐     ┌──────────┐
│ Variable │────<│ Observación │>────│ Evento │>────│ Hallazgo │
└──────────┘     └─────────────┘     └────────┘     └────┬─────┘
                                                          │
                    ┌─────────────────────────────────────┼──────────────┐
                    │                    │                │              │
               ┌────▼────┐         ┌─────▼─────┐   ┌─────▼────┐  ┌─────▼─────┐
               │Hipótesis│         │ Evidencia │   │ Prioridad│  │ Estrategia│
               └─────────┘         └───────────┘   └──────────┘  └───────────┘
                    │                    │
                    └────────┬───────────┘
                             │
                      ┌──────▼──────┐
                      │ Expediente  │  ← el verdadero producto
                      └─────────────┘
```

---

## 5. Flujo de vida del dato

```
                    INGESTA                    RAZONAMIENTO                    SALIDA
                    ───────                    ────────────                    ──────

Fuente ──→ Observación ──→ Evento ──→ Hallazgo ──→ Estrategia ──→ Reporte
              │              │           │              │
              │              │           ├── Hipótesis   │
              │              │           ├── Evidencia   │
              │              │           ├── Riesgo      │
              │              │           ├── Prioridad   │
              │              │           └── Expediente  │
              │              │                           │
              └──────────────┴───────────────────────────┘
                         Catálogo de Variables
                         Libro de Reglas
```

### Etapas y responsables

| Etapa | Módulo | Input | Output |
|-------|--------|-------|--------|
| Ingesta | Data Engine | API externa | Observación |
| Detección | Event Detector | Observación + Reglas | Evento |
| Síntesis | Hallazgo Engine | Eventos correlacionados | Hallazgo + Expediente |
| Explicación | Hypothesis Generator | Hallazgo + Evidencia | Hipótesis |
| Evaluación | Risk + Priority Engine | Hallazgo | Riesgo + Prioridad |
| Acción | Strategy Engine | Hallazgo priorizado | Estrategia |
| Síntesis | Report Generator | Hallazgos del período | Reporte |
| Lenguaje | IA Layer (Fase 4) | Hallazgo + Expediente | Texto ejecutivo |

---

## 6. Rule Engine (diseño conceptual)

Ver documento completo: `RULE-BOOK.md`

### Pipeline de reglas

```
Observaciones
    ↓
[Reglas de Detección]     → Eventos
    ↓
[Reglas de Correlación]   → Hallazgos candidatos
    ↓
[Reglas de Hipótesis]     → Hipótesis
    ↓
[Reglas de Prioridad]     → Prioridades
    ↓
[Reglas de Estrategia]    → Estrategias
```

### Anatomía de una Regla

```
Regla {
  id: string
  nombre: string
  version: string
  categoria: deteccion | correlacion | hipotesis | prioridad | estrategia | inhibicion
  activa: boolean

  condiciones: Condicion[]     // TODAS deben cumplirse (AND)
  excepciones?: Condicion[]    // Si alguna se cumple, NO ejecutar
  accion: Accion

  prioridad: number            // Orden de evaluación
  territorioIds?: string[]     // Alcance (vacío = todos)
}
```

### Tipos de condición

```
Condicion {
  variableId: string
  operador: > | < | >= | <= | == | != | cambio_% | cambio_abs | dentro_rango | fuera_rango
  valor: number | string
  ventana?: string             // "24h", "7d", "30d"
  territorioId?: string
  compararCon?: "baseline" | "historico" | "vecinos"
}
```

---

## 7. Catálogo Nacional de Variables

Ver documento completo: `VARIABLE-CATALOG.md`

La Variable es la unidad semántica — no la API. Define qué significa cada medición.

---

## 8. Manual del Analista

Ver documento completo: `ANALYST-MANUAL.md`

Define la personalidad científica del sistema: cuándo habla, cuándo calla, cuándo dice "no sé".

---

## 9. Los cuatro equipos

| Equipo | Responsabilidad | Artefactos |
|--------|-----------------|------------|
| **1. Ontology** | Modelo del mundo | Este documento, tipos TypeScript |
| **2. Data Engine** | Ingesta | Pipeline, conectores, Observation Store |
| **3. Reasoning Engine** | Inteligencia | Rule Engine, Hallazgo Engine, Expedientes |
| **4. Experience** | Interfaz | Territory Intelligence OS (ya iniciado) |

**Orden de construcción:** Equipo 1 → 2 → 3 → 4

El Equipo 4 (UI) ya tiene prototipo. Los Equipos 1-3 son el cerebro.

---

## 10. Principios de la Ontology

1. **Observación es inmutable.** Una vez persistida, no cambia.
2. **Hallazgo es el átomo de salida.** Todo converge aquí.
3. **Expediente es el producto.** Todo Hallazgo tiene uno desde su creación.
4. **Evidencia es obligatoria.** Sin evidencia, sin hallazgo visible.
5. **Hipótesis refutadas se conservan.** La ciencia necesita el historial.
6. **Reglas antes que IA.** El conocimiento experto es determinístico.
7. **Variables antes que APIs.** El catálogo define el vocabulario.
8. **La IA solo recibe Hallazgos.** Nunca Observaciones crudas.

---

*Ontology v1.0 — Julio 2026. Constitución del modelo de inteligencia TerraMind.*
