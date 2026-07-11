/**
 * Environmental Event Framework — declarative event spec.
 *
 * A spec (events/specs/<type>.event.yaml|json) declares WHAT an event is; the
 * generator turns it into a plugin scaffold. Only a constrained subset of YAML
 * is supported (maps, scalar lists, one level of nested maps) — enough for the
 * spec schema and dependency-free. JSON is fully supported.
 */
import type {
  EnvironmentalEventType,
  EnvironmentalGeometryKind,
} from '@/modules/environmental-events/types/taxonomy'

export interface EventSpec {
  event: {
    type: string
    label: string
    pluralLabel: string
    geometryKinds: string[]
    icon?: string
    description?: string
    featureFlag?: string
  }
  sources?: string[]
  contextLayers?: string[]
  findingRules?: string[]
  priorityDimensions?: Record<string, string[]>
}

export class EventSpecError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EventSpecError'
  }
}

function scalar(raw: string): string | number | boolean {
  const v = raw.trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1)
  }
  if (v === 'true') return true
  if (v === 'false') return false
  if (v !== '' && !Number.isNaN(Number(v)) && /^-?\d+(\.\d+)?$/.test(v)) return Number(v)
  return v
}

/** Minimal, dependency-free YAML subset parser. */
export function parseMinimalYaml(source: string): unknown {
  const lines = source
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.trim() !== '' && !l.trim().startsWith('#'))

  let i = 0
  const indentOf = (l: string) => l.length - l.trimStart().length

  function parseNode(minIndent: number): unknown {
    if (i >= lines.length) return null
    const ind = indentOf(lines[i])
    if (ind < minIndent) return null

    if (lines[i].trim().startsWith('- ')) {
      const arr: unknown[] = []
      while (i < lines.length && indentOf(lines[i]) === ind && lines[i].trim().startsWith('- ')) {
        const rest = lines[i].trim().slice(2).trim()
        i++
        if (rest === '') {
          arr.push(parseNode(ind + 1))
        } else {
          arr.push(scalar(rest))
        }
      }
      return arr
    }

    const obj: Record<string, unknown> = {}
    while (i < lines.length && indentOf(lines[i]) === ind && !lines[i].trim().startsWith('- ')) {
      const m = lines[i].trim().match(/^([^:]+):(.*)$/)
      if (!m) {
        i++
        continue
      }
      const key = m[1].trim()
      const val = m[2].trim()
      i++
      obj[key] = val === '' ? parseNode(ind + 1) : scalar(val)
    }
    return obj
  }

  return parseNode(0)
}

export function parseEventSpec(source: string, format: 'json' | 'yaml'): EventSpec {
  let raw: unknown
  try {
    raw = format === 'json' ? JSON.parse(source) : parseMinimalYaml(source)
  } catch (err) {
    throw new EventSpecError(
      `No se pudo parsear el spec (${format}): ${err instanceof Error ? err.message : 'error'}`,
    )
  }
  return validateEventSpec(raw)
}

const KNOWN_GEOMETRY: EnvironmentalGeometryKind[] = [
  'point',
  'multipoint',
  'line',
  'polygon',
  'multipolygon',
  'raster_reference',
  'administrative_area',
]

export function validateEventSpec(raw: unknown): EventSpec {
  if (!raw || typeof raw !== 'object') throw new EventSpecError('Spec vacío o inválido')
  const obj = raw as Record<string, unknown>
  const event = obj.event as Record<string, unknown> | undefined
  if (!event) throw new EventSpecError('Falta la sección "event"')

  const missing: string[] = []
  if (!event.type) missing.push('event.type')
  if (!event.label) missing.push('event.label')
  if (!event.pluralLabel) missing.push('event.pluralLabel')
  const geometryKinds = event.geometryKinds
  if (!Array.isArray(geometryKinds) || geometryKinds.length === 0) missing.push('event.geometryKinds')
  if (missing.length) throw new EventSpecError(`Spec incompleto: faltan ${missing.join(', ')}`)

  for (const g of geometryKinds as string[]) {
    if (!KNOWN_GEOMETRY.includes(g as EnvironmentalGeometryKind)) {
      throw new EventSpecError(`Geometría no soportada en spec: "${g}"`)
    }
  }

  return {
    event: {
      type: String(event.type),
      label: String(event.label),
      pluralLabel: String(event.pluralLabel),
      geometryKinds: (geometryKinds as string[]).map(String),
      icon: event.icon ? String(event.icon) : undefined,
      description: event.description ? String(event.description) : undefined,
      featureFlag: event.featureFlag ? String(event.featureFlag) : undefined,
    },
    sources: asStringArray(obj.sources),
    contextLayers: asStringArray(obj.contextLayers),
    findingRules: asStringArray(obj.findingRules),
    priorityDimensions: asStringArrayMap(obj.priorityDimensions),
  }
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  return v.map(String)
}

function asStringArrayMap(v: unknown): Record<string, string[]> | undefined {
  if (!v || typeof v !== 'object') return undefined
  const out: Record<string, string[]> = {}
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (Array.isArray(val)) out[k] = val.map(String)
  }
  return out
}

/** The canonical event type from a spec (string; not necessarily registered). */
export function specEventType(spec: EventSpec): EnvironmentalEventType {
  return spec.event.type as EnvironmentalEventType
}
