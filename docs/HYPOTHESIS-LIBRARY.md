# Biblioteca de Hipótesis — TerraMind

**Versión:** 0.1 (semilla)  
**Rol:** Conocimiento experto sobre causas posibles  
**Objetivo:** Cientos de hipótesis al completar  
**Principio:** No es IA. Es conocimiento codificado.

---

## Esquema

```
HipotesisTemplate {
  id: string                    // "HIP-001"
  nombre: string
  descripcion: string
  categoria: string

  // Cuándo aplicar
  condiciones: {
    requeridas: Condicion[]     // TODAS deben cumplirse
    opcionales: Condicion[]     // Refuerzan confianza
    refutacion: Condicion[]     // Si se cumplen, refutar
  }

  // Qué variables involucra
  variables: string[]
  dominios: string[]            // Knowledge Pack domains

  // Metadata
  version: string
  activa: boolean
  bibliografia?: string[]
}
```

---

## Hipótesis semilla

### HIP-001: Estrés hídrico

| Campo | Valor |
|-------|-------|
| Categoría | vegetacion, compuesto |
| Condiciones requeridas | `rainfall_anomaly < -20%` AND `ndvi` caída > 10% |
| Condiciones opcionales | `temperature_anomaly > +2°C`, `ndmi` caída |
| Refutación | `rainfall_anomaly` dentro de rango normal (-15% a +15%) |
| Variables | ndvi, rainfall_anomaly, temperature_anomaly, ndmi |
| Dominios | agricultura, agua |

---

### HIP-002: Exceso de humedad

| Campo | Valor |
|-------|-------|
| Categoría | vegetacion, hidrologico |
| Condiciones requeridas | `rainfall_anomaly > +50%` AND `ndmi` elevado |
| Condiciones opcionales | `soil_moisture` por encima de percentil 90 |
| Refutación | `rainfall_anomaly` normal |
| Variables | rainfall_anomaly, ndmi, soil_moisture |
| Dominios | agricultura, agua |

---

### HIP-003: Incendio

| Campo | Valor |
|-------|-------|
| Categoría | incendio |
| Condiciones requeridas | `fire_radiative_power > 0` OR `fire_count > 0` |
| Condiciones opcionales | `temperature_anomaly > +2°C`, `ndvi` caída post-incendio |
| Refutación | `fire_count = 0` en ventana 7d |
| Variables | fire_radiative_power, fire_count, temperature_anomaly, ndvi |
| Dominios | incendios, bosques |

---

### HIP-004: Inundación

| Campo | Valor |
|-------|-------|
| Categoría | hidrologico |
| Condiciones requeridas | `rainfall_daily > percentil 95` por 3+ días consecutivos |
| Condiciones opcionales | `official_alert` nivel naranja/rojo |
| Refutación | `rainfall_daily` normal por 5 días |
| Variables | rainfall_daily, rainfall_anomaly, official_alert |
| Dominios | agua, institucional |

---

### HIP-005: Recuperación agrícola

| Campo | Valor |
|-------|-------|
| Categoría | vegetacion |
| Condiciones requeridas | `ndvi` subiendo > 10% después de período de caída |
| Condiciones opcionales | `rainfall_anomaly` normalizándose |
| Refutación | `ndvi` sigue cayendo |
| Variables | ndvi, rainfall_anomaly, evi |
| Dominios | agricultura |

---

### HIP-006: Causa no determinada

| Campo | Valor |
|-------|-------|
| Categoría | compuesto |
| Condiciones requeridas | Evento detectado PERO ninguna otra HIP cumple |
| Acción especial | NO confirmar. Marcar expediente `pendiente_validacion`. Solicitar más datos. |
| Variables | (depende del evento) |

---

### HIP-007: Degradación por actividad humana

| Campo | Valor |
|-------|-------|
| Categoría | vegetacion, socioambiental |
| Condiciones requeridas | `ndvi` caída > 15% SIN correlación climática |
| Condiciones opcionales | Noticias GDELT sobre deforestación en zona |
| Refutación | Correlación climática fuerte (HIP-001 cumple) |
| Variables | ndvi, rainfall_anomaly, gdelt_events |

---

### HIP-008: Ola de calor

| Campo | Valor |
|-------|-------|
| Categoría | climatico |
| Condiciones requeridas | `temperature_anomaly > +3°C` por 5+ días |
| Condiciones opcionales | `humidity < percentil 20` |
| Variables | temperature_anomaly, temperature, humidity |

---

## Reglas de la biblioteca

1. Toda hipótesis tiene condiciones de **refutación** — no solo de confirmación
2. HIP-006 ("Causa no determinada") es obligatoria — el sistema debe saber decir "no sé"
3. Las hipótesis se versionan — cambios generan nueva versión
4. Una hipótesis nunca se elimina — se desactiva
5. El motor consulta la biblioteca, no inventa hipótesis

---

*Hypothesis Library v0.1 — 8 hipótesis semilla. Objetivo: cientos.*
