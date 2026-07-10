export const RISK_MAP_STYLES: Record<
  string,
  { fill: string; stroke: string; weight: number; dashArray?: string }
> = {
  informativo: { fill: '#6b7280', stroke: '#9ca3af', weight: 2, dashArray: '4 4' },
  observacion: { fill: '#eab308', stroke: '#ca8a04', weight: 2 },
  atencion: { fill: '#f97316', stroke: '#ea580c', weight: 3 },
  alto: { fill: '#ef4444', stroke: '#dc2626', weight: 3 },
  critico: { fill: '#b91c1c', stroke: '#7f1d1d', weight: 4 },
}

/** Límite aproximado de Guatemala (ADM0) con margen mínimo fronterizo. */
export const GUATEMALA_MAP_CENTER: [number, number] = [15.78, -90.23]
export const GUATEMALA_MAP_ZOOM = 7
export const GUATEMALA_MAP_BOUNDS: [[number, number], [number, number]] = [
  [13.72, -92.32],
  [17.82, -88.18],
]

export const GUATEMALA_FIT_PADDING: [number, number] = [18, 18]
export const EVENT_FIT_PADDING: [number, number] = [72, 72]
export const EVENT_FIT_MAX_ZOOM = 10

export function riskMapStyle(
  riskLevel: string,
  selected = false,
  validationStatus?: string,
) {
  const base = RISK_MAP_STYLES[riskLevel] ?? RISK_MAP_STYLES.informativo
  const validationDash =
    validationStatus === 'no_validado'
      ? '6 4'
      : validationStatus === 'confirmado'
        ? undefined
        : base.dashArray

  return {
    fillColor: base.fill,
    color: base.stroke,
    weight: selected ? base.weight + 2 : base.weight,
    opacity: selected ? 1 : 0.85,
    fillOpacity: selected ? 0.45 : 0.28,
    dashArray: validationStatus === 'confirmado' ? undefined : validationDash,
  }
}

export function centroidMarkerStyle(riskLevel: string, selected = false) {
  const base = RISK_MAP_STYLES[riskLevel] ?? RISK_MAP_STYLES.informativo
  return {
    fillColor: base.fill,
    strokeColor: selected ? '#ffffff' : base.stroke,
    radius: selected ? 14 : 11,
    weight: selected ? 3 : 2,
  }
}

export const DETECTION_MARKER_STYLE = {
  fillColor: '#38bdf8',
  strokeColor: '#0ea5e9',
  radius: 5,
}
