# Knowledge Pack — TerraMind

**Versión:** 0.1  
**Rol:** Conocimiento estructurado por dominio  
**Principio:** TerraMind no descarga internet — tiene conocimiento curado

---

## 1. Qué es un Knowledge Pack

Un Knowledge Pack es un **dominio de conocimiento estructurado** que le dice al cerebro cómo interpretar variables dentro de un contexto específico.

```
Knowledge Pack: Agricultura
  ├── Cultivos (maíz, frijol, café, caña...)
  │     ├── Fenología (siembra, crecimiento, floración, cosecha)
  │     ├── Variables importantes (NDVI, lluvia, temperatura)
  │     ├── Rangos normales por fase fenológica
  │     ├── Riesgos (sequía, exceso agua, plaga)
  │     └── Indicadores críticos
  ├── Relaciones entre variables
  └── Bibliografía
```

---

## 2. Esquema

```
KnowledgePack {
  id: string
  nombre: string
  version: string
  dominio: string
  territorioIds: string[]       // A qué territorios aplica

  entidades: KnowledgeEntity[]
  relaciones: KnowledgeRelation[]
  reglas: string[]              // IDs de reglas del Rule Book que aplican
  variables: string[]             // IDs de variables del catálogo
  hipotesis: string[]             // IDs de hipótesis de la biblioteca
}
```

```
KnowledgeEntity {
  id: string
  tipo: cultivo | ecosistema | fenomeno | protocolo | institucion
  nombre: string
  atributos: Record<string, unknown>
  fenologia?: FenologiaPhase[]
  rangosNormales?: Record<string, { min: number, max: number }>
  riesgos?: string[]
  indicadoresCriticos?: string[]
  bibliografia?: string[]
}
```

---

## 3. Packs planificados

| Pack | Dominio | Entidades estimadas |
|------|---------|---------------------|
| `agricultura-gt` | Agricultura en Guatemala | ~30 cultivos |
| `agua-gt` | Recursos hídricos | ~15 cuencas |
| `bosques-gt` | Cobertura forestal | ~10 ecosistemas |
| `incendios-gt` | Gestión de incendios | ~5 protocolos |
| `calidad-aire-gt` | Calidad del aire | ~8 zonas |
| `biodiversidad-gt` | Áreas protegidas | ~12 áreas |
| `institucional-gt` | Marco institucional | ~10 instituciones |

---

## 4. Pack semilla: Agricultura Guatemala

### Cultivo: Maíz

```
KnowledgeEntity {
  id: "cultivo-maiz",
  tipo: "cultivo",
  nombre: "Maíz",
  atributos: {
    cicloDias: 120,
    temporadaSiembra: "mayo-junio",
    temporadaCosecha: "octubre-noviembre",
    departamentosPrincipales: ["GT-16", "GT-20", "GT-21"]
  },
  fenologia: [
    { fase: "siembra", dias: "0-15", ndviEsperado: "0.2-0.4" },
    { fase: "crecimiento", dias: "15-60", ndviEsperado: "0.5-0.8" },
    { fase: "floración", dias: "60-90", ndviEsperado: "0.7-0.85" },
    { fase: "maduración", dias: "90-120", ndviEsperado: "0.4-0.6" }
  ],
  rangosNormales: {
    rainfall_daily: { min: 3, max: 15 },  // mm/día en ciclo
    temperature: { min: 18, max: 32 }
  },
  riesgos: ["sequía", "exceso_humedad", "granizada", "plaga"],
  indicadoresCriticos: ["ndvi", "rainfall_anomaly", "temperature_anomaly"]
}
```

### Cultivo: Café

```
KnowledgeEntity {
  id: "cultivo-cafe",
  tipo: "cultivo",
  nombre: "Café",
  atributos: {
    cicloDias: 365,
    altitudOptima: "800-1600m",
    departamentosPrincipales: ["GT-09", "GT-13", "GT-15"]
  },
  riesgos: ["sequía", "roya", "granizada", "helada"],
  indicadoresCriticos: ["ndvi", "ndmi", "rainfall_anomaly", "temperature"]
}
```

---

## 5. Cómo usa el cerebro los Knowledge Packs

| Etapa | Uso del Pack |
|-------|-------------|
| Validar | Rangos normales por cultivo/fenología |
| Correlacionar | Relaciones entre variables del dominio |
| Hipótesis | Contexto para seleccionar HIP relevantes |
| Escenarios | Proyecciones basadas en fenología y riesgos |
| Estrategias | Protocolos institucionales del dominio |
| Confianza | Ajustar por conocimiento del dominio |

---

## 6. Construcción de packs

Los Knowledge Packs se construyen con **expertos del dominio**, no con scraping:

1. Entrevistar agrónomos, hidrólogos, bomberos, etc.
2. Estructurar su conocimiento en el esquema
3. Validar con datos históricos
4. Versionar y mantener

**Esto es propiedad intelectual.** Un competidor no puede replicarlo conectando OpenAI.

---

*Knowledge Pack v0.1 — Semilla con agricultura. Objetivo: 7 packs territoriales.*
