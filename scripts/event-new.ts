/**
 * event:new — scaffold a complete, self-contained event plugin.
 *
 * A new event needs ONE run. This generator writes the plugin package under
 * src/events/<type>/ (+ server wiring), a declarative spec, patches the two
 * central TYPE files through anchors, and regenerates the registration indexes.
 * The scaffold compiles, registers as DISABLED (feature flag off) and passes
 * structural validation. Scientific methods (detector/source fetch) throw
 * explicit DEV errors so nothing fake ships.
 *
 * Usage:
 *   tsx scripts/event-new.ts --type flood --label "Inundación" --geometry polygon
 *   tsx scripts/event-new.ts --spec src/events/specs/flood.event.yaml
 *   tsx scripts/event-new.ts --type x --label X --geometry point --dry-run
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import {
  MANIFESTS_INDEX,
  SERVER_INDEX,
  generateManifestsIndex,
  generateServerIndex,
} from './lib/event-index.js'
import { parseEventSpec, type EventSpec } from '../src/modules/environmental-events/spec/event-spec.js'

const ROOT = process.cwd()

interface Args {
  type?: string
  label?: string
  pluralLabel?: string
  geometry?: string
  icon?: string
  sources?: string
  spec?: string
  dryRun: boolean
  force: boolean
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, force: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    if (a === '--type') args.type = next()
    else if (a === '--label') args.label = next()
    else if (a === '--pluralLabel') args.pluralLabel = next()
    else if (a === '--geometry') args.geometry = next()
    else if (a === '--icon') args.icon = next()
    else if (a === '--sources') args.sources = next()
    else if (a === '--spec') args.spec = next()
    else if (a === '--dry-run') args.dryRun = true
    else if (a === '--force') args.force = true
  }
  return args
}

function fail(message: string): never {
  console.error(`[event:new] ${message}`)
  process.exit(1)
}

function pascal(type: string): string {
  return type
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
}

function toSpec(args: Args): EventSpec {
  if (args.spec) {
    const path = resolve(ROOT, args.spec)
    if (!existsSync(path)) fail(`Spec no encontrado: ${args.spec}`)
    const format = path.endsWith('.json') ? 'json' : 'yaml'
    return parseEventSpec(readFileSync(path, 'utf8'), format)
  }
  if (!args.type || !args.label || !args.geometry) {
    fail('Faltan argumentos: --type, --label y --geometry (o --spec).')
  }
  return {
    event: {
      type: args.type!,
      label: args.label!,
      pluralLabel: args.pluralLabel ?? `${args.label!}s`,
      geometryKinds: args.geometry!.split(',').map((s) => s.trim()),
      icon: args.icon ?? 'circle',
      featureFlag: args.type!,
    },
    sources: args.sources?.split(',').map((s) => s.trim()),
    findingRules: [],
  }
}

interface Plan {
  files: Array<{ path: string; content: string }>
  patches: Array<{ path: string; label: string; apply: () => string }>
}

function buildPlan(spec: EventSpec): Plan {
  const type = spec.event.type
  if (!/^[a-z][a-z0-9_]+$/.test(type)) fail(`type debe ser snake_case: "${type}"`)
  const folder = type.replace(/_/g, '-')
  const P = pascal(type)
  const dir = resolve(ROOT, 'src/events', folder)
  const serverFile = resolve(ROOT, 'server/events', `${folder}.server.ts`)
  const specFile = resolve(ROOT, 'src/events/specs', `${type}.event.yaml`)

  const geometryKinds = spec.event.geometryKinds
  const geomLiteral = geometryKinds.map((g) => `'${g}'`).join(', ')
  const supportsPolygon = geometryKinds.some((g) => g.includes('polygon'))
  const featureFlag = spec.event.featureFlag ?? type
  const icon = spec.event.icon ?? 'circle'
  const sources = spec.sources && spec.sources.length ? spec.sources : ['placeholder_source']
  const findingRuleIds = spec.findingRules ?? []

  const files: Array<{ path: string; content: string }> = []
  const add = (name: string, content: string) => files.push({ path: resolve(dir, name), content })

  add(
    'event.types.ts',
    `/** ${spec.event.label} plugin — type-specific attributes (facade). */
export type {
  ${P}EventAttributes,
  ${P}EnvironmentalEvent,
} from '@/modules/environmental-events/types/environmental-event.types'
`,
  )

  add(
    'event.methodology.ts',
    `/** ${spec.event.label} plugin — methodology copy (Spanish). */
export const ${camel(type)}Methodology =
  'PENDIENTE: documentar la metodología científica de ${spec.event.label}. No usar en producción.'
`,
  )

  add(
    'event.limitations.ts',
    `/** ${spec.event.label} plugin — limitations. */
export const ${camel(type)}Limitations: string[] = [
  'PENDIENTE: definir limitaciones reales antes de habilitar en runtime.',
]
`,
  )

  add(
    'event.detail-sections.ts',
    `/** ${spec.event.label} plugin — detail sections metadata. */
import type { EventDetailSection } from '@/modules/environmental-events/manifest/event-manifest'

export const ${camel(type)}DetailSections: EventDetailSection[] = [
  { id: 'evidence', title: 'Evidencia' },
  { id: 'interpretation', title: 'Interpretación' },
]
`,
  )

  add(
    'event.sources.ts',
    `/** ${spec.event.label} plugin — source descriptors. */
import type { ObservationSourceDescriptor } from '@/modules/environmental-events/types/observation.types'

export const ${camel(type)}SourceDescriptors: ObservationSourceDescriptor[] = [
${sources
  .map(
    (s) => `  {
    id: '${s}',
    label: '${s}',
    supportedEventTypes: ['${type}'],
    providerNames: ['${s}'],
  },`,
  )
  .join('\n')}
]
`,
  )

  add(
    'event.presentation.ts',
    `/** ${spec.event.label} plugin — presentation adapter. */
import type { EnvironmentalEventPresentationAdapter } from '@/modules/environmental-events/contracts/presentation'
import type { EventKeyMetric } from '@/modules/environmental-events/types/environmental-event.types'
import type { ${P}EnvironmentalEvent } from './event.types'

export class ${P}PresentationAdapter
  implements EnvironmentalEventPresentationAdapter<${P}EnvironmentalEvent>
{
  readonly eventType = '${type}' as const

  getDisplayName(event: ${P}EnvironmentalEvent): string {
    return event.title
  }
  getSummary(event: ${P}EnvironmentalEvent): string {
    return event.summary ?? event.title
  }
  getStatusLabel(): string {
    return 'Pendiente'
  }
  getLifecycleLabel(): string {
    return 'Pendiente'
  }
  getSeverityLabel(): string {
    return 'No disponible'
  }
  getConfidenceLabel(): string {
    return 'No disponible'
  }
  getLimitations(): string[] {
    return ['PENDIENTE: limitaciones reales.']
  }
  getKeyMetrics(): EventKeyMetric[] {
    return []
  }
}

export const ${camel(type)}PresentationAdapter = new ${P}PresentationAdapter()
`,
  )

  add(
    'event.map-renderer.ts',
    `/** ${spec.event.label} plugin — map renderer. */
import type {
  EnvironmentalEventMapRenderer,
  EventLegendDefinition,
  EventMapLayerDefinition,
  EventMapPopupModel,
} from '@/modules/environmental-events/contracts/map-renderer'
import type { EnvironmentalGeometryKind } from '@/modules/environmental-events/types/taxonomy'
import type { ${P}EnvironmentalEvent } from './event.types'

export class ${P}MapRenderer
  implements EnvironmentalEventMapRenderer<${P}EnvironmentalEvent>
{
  readonly eventType = '${type}' as const
  readonly supportedGeometryKinds: EnvironmentalGeometryKind[] = [${geomLiteral}]

  toMapFeature(event: ${P}EnvironmentalEvent): GeoJSON.Feature {
    return {
      type: 'Feature',
      geometry: event.geometry,
      properties: { id: event.id, event_type: event.eventType, title: event.title },
    }
  }
  getLayerDefinition(): EventMapLayerDefinition {
    return { id: '${type}_layer', kind: ${supportsPolygon ? "'polygon'" : "'point'"}, clustered: false }
  }
  getLegendDefinition(): EventLegendDefinition {
    return {
      title: '${spec.event.label}',
      groups: [{ title: '${spec.event.label}', items: [{ label: '${spec.event.label}', color: '#888888', shape: 'disc' }] }],
    }
  }
  getPopupModel(event: ${P}EnvironmentalEvent): EventMapPopupModel {
    return { title: event.title, rows: [], disclaimer: 'PENDIENTE: contenido real.' }
  }
  supportsGeometry(geometry: GeoJSON.Geometry): boolean {
    return this.supportedGeometryKinds.some((k) => geometry.type.toLowerCase().includes(k.replace('multi', '')))
  }
}

export const ${camel(type)}MapRenderer = new ${P}MapRenderer()
`,
  )

  add(
    'event.priority-provider.ts',
    `/** ${spec.event.label} plugin — priority factor provider (contract; no science yet). */
import type {
  EventPriorityFactorProvider,
  PriorityFactorContribution,
} from '@/modules/environmental-events/contracts/priority-provider'
import type { ${P}EnvironmentalEvent } from './event.types'

export const ${type.toUpperCase()}_PRIORITY_PROVIDER_ID = '${type}_priority_factors'

export class ${P}PriorityFactorProvider
  implements EventPriorityFactorProvider<${P}EnvironmentalEvent>
{
  readonly eventType = '${type}' as const
  getSeverityFactors(): PriorityFactorContribution[] {
    return []
  }
  getExposureFactors(): PriorityFactorContribution[] {
    return []
  }
  getPersistenceFactors(): PriorityFactorContribution[] {
    return []
  }
  getSensitivityFactors(): PriorityFactorContribution[] {
    return []
  }
  getUncertaintyFactors(): PriorityFactorContribution[] {
    return []
  }
  getUrgencyFactors(): PriorityFactorContribution[] {
    return []
  }
}

export const ${camel(type)}PriorityFactorProvider = new ${P}PriorityFactorProvider()
`,
  )

  add(
    'event.finding-rules.ts',
    `/** ${spec.event.label} plugin — type-specific finding rules (none yet; reusable via manifest ids). */
import type { EnvironmentalFindingRule } from '@/modules/environmental-events/contracts/finding-rule'
import type { ${P}EnvironmentalEvent } from './event.types'

export const ${camel(type)}SpecificFindingRules: EnvironmentalFindingRule<${P}EnvironmentalEvent>[] = []
`,
  )

  add(
    'event.report-adapter.ts',
    `/** ${spec.event.label} plugin — report adapter. */
import type { EventReportAdapter } from '@/modules/environmental-events/contracts/report-adapter'
import type { ReportSection } from '@/modules/institutional-reports/institutional-report.types'
import type {
  EnvironmentalEvent,
  ${P}EnvironmentalEvent,
} from '@/modules/environmental-events/types/environmental-event.types'

export class ${P}ReportAdapter implements EventReportAdapter {
  readonly eventType = '${type}' as const
  buildSection(events: EnvironmentalEvent[]): ReportSection {
    const own = events.filter((e): e is ${P}EnvironmentalEvent => e.eventType === '${type}')
    return {
      id: '${type}',
      title: '${spec.event.label}',
      content: own.length === 0 ? 'Sin eventos.' : \`\${own.length} evento(s).\`,
      status: 'pending',
    }
  }
}

export const ${camel(type)}ReportAdapter = new ${P}ReportAdapter()
`,
  )

  add(
    'event.repository.ts',
    `/**
 * ${spec.event.label} plugin — repository (SCAFFOLD).
 * Returns empty results until the real store is wired. Never enabled in runtime.
 */
import type {
  EnvironmentalEventPage,
  EnvironmentalEventQuery,
} from '@/modules/environmental-events/types/environmental-event.types'
import type {
  EnvironmentalEventRepository,
  RelatedFindingRef,
  RelatedIncidentRef,
  RelatedPriorityRef,
} from '@/modules/environmental-events/contracts/repository'
import type { ${P}EnvironmentalEvent } from './event.types'

export class ${P}Repository implements EnvironmentalEventRepository {
  async list(query: EnvironmentalEventQuery): Promise<EnvironmentalEventPage> {
    return {
      items: [],
      pagination: { page: 1, limit: query.limit ?? 50, total: 0 },
      generatedAt: new Date().toISOString(),
    }
  }
  async getById(id: string): Promise<${P}EnvironmentalEvent | null> {
    void id
    return null
  }
  async getRelatedFindings(): Promise<RelatedFindingRef[]> {
    return []
  }
  async getRelatedPriority(): Promise<RelatedPriorityRef> {
    return { id: null, attentionScore: null, attentionLevel: null }
  }
  async getRelatedIncident(): Promise<RelatedIncidentRef> {
    return { id: null, status: null }
  }
}

export const ${camel(type)}Repository = new ${P}Repository()
`,
  )

  add(
    'event.detector.ts',
    `/**
 * ${spec.event.label} plugin — detector (SCAFFOLD; NO SCIENCE).
 * Throws explicit DEV errors so nothing fake ships. Implement real clustering
 * before enabling the feature flag.
 */
import type {
  DetectedEventResult,
  EnvironmentalEventDetector,
} from '@/modules/environmental-events/contracts/detector'
import type { EnvironmentalObservation } from '@/modules/environmental-events/types/observation.types'
import type { ${P}EnvironmentalEvent } from './event.types'

type Obs = EnvironmentalObservation<'${type}', unknown>

export class ${P}Detector
  implements EnvironmentalEventDetector<Obs, ${P}EnvironmentalEvent>
{
  readonly eventType = '${type}' as const
  async detect(): Promise<DetectedEventResult<${P}EnvironmentalEvent>[]> {
    throw new Error('DEV: ${type} detector no implementado. Implementa la ciencia real.')
  }
  async update(): Promise<DetectedEventResult<${P}EnvironmentalEvent>> {
    throw new Error('DEV: ${type} detector.update no implementado.')
  }
  shouldClose(): boolean {
    throw new Error('DEV: ${type} detector.shouldClose no implementado.')
  }
}

export const ${camel(type)}Detector = new ${P}Detector()
`,
  )

  add(
    'event.manifest.ts',
    `/**
 * ${spec.event.label} — single manifest (SCAFFOLD, disabled).
 * Sole integration point. Enable only after the science is implemented.
 */
import {
  defineEnvironmentalEvent,
  type EnvironmentalEventManifest,
} from '@/modules/environmental-events/manifest/event-manifest'
import { ${camel(type)}PresentationAdapter } from './event.presentation'
import { ${camel(type)}MapRenderer } from './event.map-renderer'
import {
  ${camel(type)}PriorityFactorProvider,
  ${type.toUpperCase()}_PRIORITY_PROVIDER_ID,
} from './event.priority-provider'
import { ${camel(type)}SpecificFindingRules } from './event.finding-rules'
import { ${camel(type)}SourceDescriptors } from './event.sources'
import { ${camel(type)}ReportAdapter } from './event.report-adapter'
import { ${camel(type)}DetailSections } from './event.detail-sections'
import { ${camel(type)}Methodology } from './event.methodology'
import { ${camel(type)}Limitations } from './event.limitations'

export const ${camel(type)}Manifest: EnvironmentalEventManifest = defineEnvironmentalEvent({
  type: '${type}',
  label: '${spec.event.label}',
  pluralLabel: '${spec.event.pluralLabel}',
  description: '${spec.event.description ?? `SCAFFOLD de ${spec.event.label}.`}',
  icon: '${icon}',
  geometryKinds: [${geomLiteral}],
  sources: ${camel(type)}SourceDescriptors,
  presentation: ${camel(type)}PresentationAdapter,
  mapRenderer: ${camel(type)}MapRenderer,
  priorityProvider: ${camel(type)}PriorityFactorProvider,
  priorityProviderId: ${type.toUpperCase()}_PRIORITY_PROVIDER_ID,
  reportAdapter: ${camel(type)}ReportAdapter,
  findingRuleIds: [${findingRuleIds.map((r) => `'${r}'`).join(', ')}],
  typeSpecificFindingRules: ${camel(type)}SpecificFindingRules,
  detailSections: ${camel(type)}DetailSections,
  methodology: ${camel(type)}Methodology,
  limitations: ${camel(type)}Limitations,
  defaultFilters: {},
  supportedContextLayers: [${(spec.contextLayers ?? []).map((c) => `'${c}'`).join(', ')}],
  permissions: { view: 'incidents.view' },
  runtime: { featureFlag: '${featureFlag}', enabledByDefault: false },
})

export default ${camel(type)}Manifest
`,
  )

  add(
    'event.test.ts',
    `import { describe, expect, it } from 'vitest'
import { ensureEventsRegistered } from '@/modules/environmental-events/registry/register-all'
import { environmentalEventRegistry } from '@/modules/environmental-events/registry/event-type-registry'

describe('${type} plugin (scaffold)', () => {
  it('is auto-registered but disabled in runtime', () => {
    ensureEventsRegistered()
    expect(environmentalEventRegistry.has('${type}')).toBe(true)
    expect(environmentalEventRegistry.isEnabled('${type}')).toBe(false)
  })
})
`,
  )

  // Server wiring (empty repository so the service can resolve the type).
  const serverContent = `/** ${spec.event.label} plugin — server wiring (SCAFFOLD). */
import { serverEventRegistry } from '@/modules/environmental-events/registry/server-event-registry'
import { ${camel(type)}Repository } from '@/events/${folder}/event.repository'
import { ${camel(type)}Detector } from '@/events/${folder}/event.detector'

serverEventRegistry.register({
  type: '${type}',
  repository: ${camel(type)}Repository,
  detector: ${camel(type)}Detector,
})
`
  files.push({ path: serverFile, content: serverContent })

  // Spec file (only if missing).
  if (!existsSync(specFile)) {
    files.push({ path: specFile, content: renderSpecYaml(spec) })
  }

  // Central type patches (the only central files touched: 0–2).
  const patches: Plan['patches'] = [
    {
      path: resolve(ROOT, 'src/modules/environmental-events/types/taxonomy.ts'),
      label: 'taxonomy.ts (union + type guard)',
      apply: () => {
        let src = readFileSync(resolve(ROOT, 'src/modules/environmental-events/types/taxonomy.ts'), 'utf8')
        if (!src.includes(`| '${type}'`)) {
          src = src.replace(
            '// event:new:union (do not remove — anchor for the generator)',
            `  | '${type}'\n// event:new:union (do not remove — anchor for the generator)`,
          )
        }
        if (!src.includes(`v === '${type}'`)) {
          src = src.replace(
            '    // event:new:guard (do not remove — anchor for the generator)',
            `    v === '${type}' ||\n    // event:new:guard (do not remove — anchor for the generator)`,
          )
        }
        return src
      },
    },
    {
      path: resolve(ROOT, 'src/modules/environmental-events/types/environmental-event.types.ts'),
      label: 'environmental-event.types.ts (attributes + union)',
      apply: () => {
        let src = readFileSync(
          resolve(ROOT, 'src/modules/environmental-events/types/environmental-event.types.ts'),
          'utf8',
        )
        if (!src.includes(`${P}EventAttributes`)) {
          const block = `export interface ${P}EventAttributes {
  placeholder?: number
}

export type ${P}EnvironmentalEvent = BaseEnvironmentalEvent<
  '${type}',
  ${P}EventAttributes
>

// event:new:attributes (do not remove — anchor for the generator)`
          src = src.replace('// event:new:attributes (do not remove — anchor for the generator)', block)
        }
        if (!src.includes(`| ${P}EnvironmentalEvent`)) {
          src = src.replace(
            '// event:new:event-union (do not remove — anchor for the generator)',
            `  | ${P}EnvironmentalEvent\n// event:new:event-union (do not remove — anchor for the generator)`,
          )
        }
        return src
      },
    },
  ]

  return { files, patches }
}

function camel(type: string): string {
  const p = pascal(type)
  return p.charAt(0).toLowerCase() + p.slice(1)
}

function renderSpecYaml(spec: EventSpec): string {
  const lines: string[] = ['event:']
  lines.push(`  type: ${spec.event.type}`)
  lines.push(`  label: ${spec.event.label}`)
  lines.push(`  pluralLabel: ${spec.event.pluralLabel}`)
  if (spec.event.icon) lines.push(`  icon: ${spec.event.icon}`)
  if (spec.event.featureFlag) lines.push(`  featureFlag: ${spec.event.featureFlag}`)
  lines.push('  geometryKinds:')
  for (const g of spec.event.geometryKinds) lines.push(`    - ${g}`)
  if (spec.sources?.length) {
    lines.push('', 'sources:')
    for (const s of spec.sources) lines.push(`  - ${s}`)
  }
  if (spec.findingRules?.length) {
    lines.push('', 'findingRules:')
    for (const r of spec.findingRules) lines.push(`  - ${r}`)
  }
  return lines.join('\n') + '\n'
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  const spec = toSpec(args)
  const type = spec.event.type
  const folder = type.replace(/_/g, '-')
  const dir = resolve(ROOT, 'src/events', folder)

  if (existsSync(dir) && !args.force && !args.dryRun) {
    fail(`El plugin ya existe: src/events/${folder} (usa --force para sobrescribir).`)
  }

  const plan = buildPlan(spec)

  if (args.dryRun) {
    console.log(`[event:new] DRY-RUN para "${type}". Archivos que se crearían:`)
    for (const f of plan.files) console.log('  + ' + f.path.replace(ROOT, '.'))
    console.log('[event:new] Archivos centrales que se parchearían (por marcadores):')
    for (const p of plan.patches) console.log('  ~ ' + p.label)
    console.log('  ~ src/events/manifests.generated.ts (regenerado)')
    console.log('  ~ server/events/server.generated.ts (regenerado)')
    return
  }

  for (const f of plan.files) {
    mkdirSync(dirname(f.path), { recursive: true })
    writeFileSync(f.path, f.content, 'utf8')
    console.log('  + ' + f.path.replace(ROOT, '.'))
  }
  for (const p of plan.patches) {
    writeFileSync(p.path, p.apply(), 'utf8')
    console.log('  ~ ' + p.label)
  }

  writeFileSync(MANIFESTS_INDEX, generateManifestsIndex(), 'utf8')
  writeFileSync(SERVER_INDEX, generateServerIndex(), 'utf8')
  console.log('  ~ índices regenerados (manifests + server)')

  console.log(`\n[event:new] Plugin "${type}" creado (DISABLED).`)
  console.log('Siguientes pasos:')
  console.log(`  1. Implementa la ciencia real (event.detector.ts, event.repository.ts).`)
  console.log(`  2. npm run event:validate -- ${type}`)
  console.log(`  3. npm run event:test -- ${type}`)
  console.log(`  4. Activa el feature flag cuando esté listo.`)
}

main()
