# Population Estimate Confidence — Calibration Notes (7D.3.1)

## Problem

WorldPop constrained redistributes population toward built surfaces. Unconstrained
distributes more continuously. At 500 m–1 km buffers both can diverge sharply in rural
or incomplete building contexts. A single constrained value (e.g. 11) must not be shown
as a precise resident count when unconstrained reports 1,259.

## Confidence rules (implemented)

| `difference_pct` (symmetric vs lower model) | Level      | Display mode                 |
| ------------------------------------------- | ---------- | ---------------------------- |
| &lt; 5%                                     | high       | `single_estimate`            |
| 5–20%                                       | moderate   | `estimate_with_uncertainty`  |
| 20–100%                                     | low        | `modelled_range`             |
| ≥ 100%                                      | very_low   | `modelled_range`             |

When the lower estimate is zero, `difference_pct` is capped at 100% and ratio is null
to avoid misleading division.

`modelled_range` = min/max of constrained and unconstrained — **not** a statistical
confidence interval.

## Territorial interpretive factors (no correction)

- `built_up_fraction` from land cover buffer
- settlement distance / municipal seat proximity
- partial coverage, cell count vs buffer radius
- `local_estimate_scale_sensitive` for 500 m + rural/low cell count

## Future calibration (not in 7D.3.1)

- Complete INE lugares poblados
- Población por localidad y geometrías ADM2
- Validación contra censo y reconciliación municipal
- Building footprints propios
- Comparación GHSL
- Ajuste dasimétrico propio

## Audit

```bash
npm run population:audit-confidence
```

Re-enrichment optional; API/UI compute confidence at DTO build time from stored
constrained/unconstrained values.
