/**
 * Cifras del informe 7D.1A inicial (histograma GDAL — superseded por 7D.1A.1).
 * Conservadas para trazabilidad; no usar en validación técnica.
 */
export const POPULATION_7D1A_SUPERSEDED = {
  method: 'gdalinfo_histogram_midpoint',
  rootCause:
    'Sumas derivadas de histograma GDAL (punto medio por bucket), no lectura píxel a píxel. ' +
    'Métodos distintos entre raw y clip produjeron falsos incrementos post-recorte y aprobación LAEA incorrecta.',
  constrained: {
    raw_sum: 17_170_496,
    wgs84_clip_sum: 17_196_427,
    laea_delta_pct: 0.27,
    laea_incorrectly_approved: true,
  },
  unconstrained: {
    raw_sum: 17_251_094,
    wgs84_clip_sum: 17_692_858,
    laea_delta_pct: 1.17,
    laea_incorrectly_approved: true,
  },
} as const
