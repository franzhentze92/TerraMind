/** Política compartida: qué estados geográficos son dibujables en el mapa. */
export const MAPPABLE_STATUSES = new Set([
  'localizada',
  'ubicacion_aproximada',
  'varias_ubicaciones',
])

export const NON_MAPPABLE_STATUSES = new Set(['nacional', 'internacional', 'sin_ubicacion'])
