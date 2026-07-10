# Sistema de Confianza — TerraMind

**Versión:** 1.0  
**Rol:** Explicar por qué el sistema confía — no opinar  
**Principio:** Determinístico, auditable, explicable

---

## 1. Por qué importa

ChatGPT dice cosas. TerraMind explica **por qué confía**.

```
Confianza: 91%

porque:
  ✓ Sentinel coincide
  ✓ ERA5 coincide
  ✓ CHIRPS coincide
  ✓ Noticias coinciden
  ✗ No existe evidencia contradictoria
```

Eso genera **confianza institucional** — la diferencia entre un chatbot y una plataforma de inteligencia.

---

## 2. Los 6 factores de confianza

| # | Factor | Peso | Qué mide |
|---|--------|------|----------|
| 1 | Fuentes independientes | 25% | ¿Cuántas fuentes distintas corroboran? |
| 2 | Coherencia temporal | 15% | ¿Los datos son del mismo período? |
| 3 | Coherencia espacial | 10% | ¿Los datos son del mismo territorio? |
| 4 | Ratio de evidencia | 25% | ¿Cuánta evidencia a favor vs en contra? |
| 5 | Calidad de observaciones | 10% | ¿Qué tan confiables son los datos? |
| 6 | Corroboración de hipótesis | 15% | ¿La hipótesis principal está respaldada? |

**Score total = suma ponderada de los 6 factores (0-100)**

---

## 3. Cálculo por factor

### Factor 1: Fuentes independientes (max 25)

| Fuentes | Score |
|---------|-------|
| 0-1 | 0 |
| 2 | 15 |
| 3 | 20 |
| 4+ | 25 |

"Independientes" = fuentes con diferente `fuenteId` en el catálogo.

### Factor 2: Coherencia temporal (max 15)

| Condición | Score |
|-----------|-------|
| Todas las observaciones en ventana ≤ 7 días | 15 |
| Ventana ≤ 14 días | 12 |
| Ventana ≤ 30 días | 8 |
| Ventana > 30 días | 3 |
| Datos de períodos no comparables | 0 |

### Factor 3: Coherencia espacial (max 10)

| Condición | Score |
|-----------|-------|
| Mismo territorioId | 10 |
| Territorios adyacentes | 7 |
| Mismo departamento | 5 |
| Diferente departamento | 2 |
| Diferente país | 0 |

### Factor 4: Ratio de evidencia (max 25)

```
ratio = evidencia_a_favor / (evidencia_a_favor + evidencia_en_contra)

| Ratio | Score |
|-------|-------|
| ≥ 0.9 (casi sin contradicción) | 25 |
| ≥ 0.75 | 20 |
| ≥ 0.6 | 15 |
| ≥ 0.5 | 8 |
| < 0.5 (más en contra que a favor) | 0 |
```

### Factor 5: Calidad de observaciones (max 10)

```
promedio_calidad = mean(observacion.calidad for obs in evidencia)

score = (promedio_calidad / 100) × 10
```

### Factor 6: Corroboración de hipótesis (max 15)

| Estado hipótesis principal | Score |
|---------------------------|-------|
| confirmada | 15 |
| activa (confianza ≥ 70) | 12 |
| activa (confianza ≥ 50) | 8 |
| propuesta | 4 |
| refutada | 0 |

---

## 4. Niveles de confianza

| Score | Nivel | Color | Acción del sistema |
|-------|-------|-------|-------------------|
| 85-100 | Alta | Verde | Confirmar hallazgo, generar estrategia |
| 60-84 | Media | Amarillo | Presentar con advertencia, estrategia conservadora |
| 30-59 | Baja | Rojo | Presentar solo a analistas, no a ejecutivos |
| 0-29 | Insuficiente | Gris | No presentar. Almacenar internamente. |

---

## 5. Explicación legible

El sistema SIEMPRE produce una explicación junto al score:

```typescript
interface ConfidenceExplanation {
  score: number
  nivel: 'alta' | 'media' | 'baja' | 'insuficiente'
  factores: ConfidenceFactor[]
  explicacion: string          // Texto legible
  explicacionCorta: string     // Una línea
}

interface ConfidenceFactor {
  id: string
  nombre: string
  score: number
  maxScore: number
  detalle: string
  icono: 'check' | 'warning' | 'cross'
}
```

**Generación de explicación:**

```
Para cada factor con score > 0:
  Si icono = check → "✓ {detalle}"
  Si icono = warning → "⚠ {detalle}"
  Si icono = cross → "✗ {detalle}"

explicacion = "Confianza {score}% porque " + factores_positivos.join(", ") + "."
```

**Ejemplo output:**
```
Confianza 91% porque Sentinel coincide, ERA5 coincide, CHIRPS coincide,
no existe evidencia contradictoria.
```

---

## 6. Confianza y el Analyst Manual

| Situación | Efecto en confianza |
|-----------|-------------------|
| Evidencia contradictoria (ratio < 0.6) | Cap en 59 (nunca "media" o "alta") |
| Solo 1 fuente | Cap en 40 |
| Datos > 7 días sin actualizar | Reducir factor temporal a 0 |
| Cobertura de nubes > 80% | Reducir factor calidad 50% |
| Hipótesis refutada | Factor corroboración = 0 |

---

## 7. Confianza no es opinión de la IA

```
❌ OpenAI dice: "Estoy 91% seguro de que hay estrés hídrico"
✅ TerraMind dice: "Confianza 91% porque 3 fuentes independientes corroboran,
   0 evidencia en contra, hipótesis confirmada"
```

La IA (Fase 4) recibe la explicación ya calculada. No la genera.

---

*Confidence System v1.0 — La credibilidad institucional de TerraMind.*
