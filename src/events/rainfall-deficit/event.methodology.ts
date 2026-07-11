/** Déficit de precipitación — methodology (Spanish). */
export const rainfallDeficitMethodology = `## Metodología — Déficit de precipitación persistente

1. **Fuente:** CHIRPS v3 (Climate Hazards Center, UC Santa Barbara), producto pentadal.
2. **Resolución:** aproximadamente 0,05° (promedio de área, no parcela).
3. **Periodo histórico de referencia:** 1991–2020, mismas pentadas estacionales.
4. **Timestep operativo:** pentada (5 días); no se finge precisión diaria nativa.
5. **Ventanas de análisis:** 15, 30 y 60 días; ventana canónica de 30 días.
6. **Comparación:** precipitación acumulada observada vs distribución histórica de la misma época.
7. **Percentil:** percentil empírico (fracción de años históricos ≤ valor observado).
8. **Déficit relativo:** (esperado − observado) / esperado, con mediana histórica como referencia.
9. **Piso estacional:** mínimo de precipitación esperada configurable para evitar falsos positivos en estación seca normal.
10. **Persistencia:** pentadas consecutivas cumpliendo criterios simultáneos.
11. **Agrupación:** celdas candidatas contiguas (4-vecinos) con área mínima.
12. **Ciclo de vida:** en formación, expansión, persistente, recuperación, finalizado.
13. **Preliminary vs Final:** productos registrados por separado; el final reemplaza/versiona al preliminar sin duplicar eventos.

<details>
<summary>Detalle técnico</summary>

- Formato: GeoTIFF pentadal LATAM subset.
- Checksum SHA-256 por producto ingerido.
- processingVersion: rainfall-deficit-mvp-1.
- Umbrales iniciales versionados (no verdad universal).
- Algoritmo: rainfall-deficit-v1.

</details>`
