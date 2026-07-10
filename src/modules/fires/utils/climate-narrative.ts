import type { ClimateContextDto } from '@/modules/fires/types/fire.dto'

function fmt(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toFixed(digits)
}

export function buildClimateEventNarrative(context: ClimateContextDto): string {
  const temp = context.event_conditions.temperature_c?.mean
  const humidity = context.event_conditions.relative_humidity_pct?.mean
  const wind = context.event_conditions.wind_speed_kmh?.mean
  const parts: string[] = []

  if (temp != null || humidity != null || wind != null) {
    parts.push(
      `Al momento de la detección, la condición modelada indicaba temperatura de ${fmt(temp)} °C, humedad relativa de ${fmt(humidity, 0)}% y viento medio de ${fmt(wind)} km/h.`,
    )
  }

  const rain24 = context.antecedent.precipitation_previous_24h_mm
  if (rain24 != null) {
    if (rain24 < 0.5) {
      parts.push('No se acumuló precipitación significativa durante las 24 horas previas.')
    } else {
      parts.push(
        `Se estiman ${fmt(rain24)} mm de precipitación modelada acumulada en las 24 horas previas.`,
      )
    }
  }

  const windFrom = context.event_conditions.wind_direction?.cardinal
  const windToward = context.event_conditions.wind_direction?.toward_cardinal
  if (windFrom && windToward) {
    parts.push(
      `El viento modelado proviene del ${windFrom} y se desplaza hacia el ${windToward}.`,
    )
  }

  if (context.forecast.available && context.forecast.precipitation_next_72h_mm != null) {
    parts.push(
      `Se pronostican ${fmt(context.forecast.precipitation_next_72h_mm)} mm de lluvia modelada durante las próximas 72 horas.`,
    )
  }

  return parts.join(' ')
}

export function assertClimateNarrativeSafe(text: string): void {
  const forbidden = [
    'propagación confirmada',
    'causa del evento',
    'incendio activo',
    'humo dirigido',
    'observado en estación',
    'anómala',
    'más seco de lo normal',
  ]
  const lower = text.toLowerCase()
  for (const term of forbidden) {
    if (lower.includes(term)) throw new Error(`Narrativa climática contiene término prohibido: ${term}`)
  }
}
