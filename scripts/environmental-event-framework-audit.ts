#!/usr/bin/env tsx
/**
 * environmental-event-framework:audit
 *
 * Gate for the Environmental Event Framework as an EXTENSIBILITY FACTORY.
 * Beyond contracts/parity/auth, it now fails if:
 *  - there is no single manifest per event;
 *  - a plugin needs manual multi-registry edits (generated indexes out of sync);
 *  - event:new / event:validate / event:test / event:sync are missing;
 *  - the synthetic plugin is not auto-detected (or leaks into runtime);
 *  - Situación Nacional / reports / map require central per-type edits;
 *  - more than two central files are touched for the synthetic plugin;
 *  - the single-execution prompt template or extensibility report is missing.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

import { environmentalEventRegistry } from '@/modules/environmental-events'
import { environmentalFindingRuleRegistry } from '@/modules/environmental-events/registry/finding-rule-registry'
import { registerThermalActivity } from '@/modules/environmental-events/thermal/register-thermal'
import { mapFireEventToEnvironmentalEvent } from '@/modules/environmental-events/thermal/thermal-event.mapper'
import { toFireEventsQuery } from '@/modules/environmental-events/thermal/thermal-query.mapper'
import type { FireEventListItemDto } from '@/modules/fires/types/fire.dto'
import {
  MANIFESTS_INDEX,
  SERVER_INDEX,
  generateManifestsIndex,
  generateServerIndex,
} from './lib/event-index.js'

const ROOT = process.cwd()
const failures: string[] = []
const passes: string[] = []

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) passes.push(name)
  else failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
}

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8')
}

registerThermalActivity()

// ── 1. Required framework + plugin files ────────────────────────────────────
const requiredFiles = [
  'src/modules/environmental-events/manifest/event-manifest.ts',
  'src/modules/environmental-events/registry/event-type-registry.ts',
  'src/modules/environmental-events/registry/finding-rule-registry.ts',
  'src/modules/environmental-events/registry/server-event-registry.ts',
  'src/modules/environmental-events/registry/register-all.ts',
  'src/modules/environmental-events/finding-rules/reusable-rules.ts',
  'src/modules/environmental-events/contracts/report-adapter.ts',
  'src/modules/environmental-events/ui/event-ui.ts',
  'src/modules/environmental-events/spec/event-spec.ts',
  'src/events/manifests.generated.ts',
  'server/events/server.generated.ts',
  // Thermal plugin (facade)
  'src/events/thermal-activity/event.manifest.ts',
  'src/events/thermal-activity/event.presentation.ts',
  'src/events/thermal-activity/event.report-adapter.ts',
  'server/events/thermal-activity.server.ts',
  // Synthetic plugin
  'src/events/synthetic-framework-test/event.manifest.ts',
  'src/events/synthetic-framework-test/event.repository.ts',
  'src/events/synthetic-framework-test/event.test.ts',
  'server/events/synthetic-framework-test.server.ts',
  // Generator + validation tooling
  'scripts/event-new.ts',
  'scripts/event-sync.ts',
  'scripts/event-validate.ts',
  'scripts/event-test.ts',
  'scripts/lib/event-index.ts',
  // Declarative specs
  'src/events/specs/thermal_activity.event.yaml',
  'src/events/specs/flood.event.yaml',
  // Docs
  'docs/multi-event/ENVIRONMENTAL-EVENT-FRAMEWORK-DESIGN.md',
  'docs/multi-event/ADDING-A-NEW-EVENT-TYPE.md',
  'docs/multi-event/NEW-EVENT-IMPLEMENTATION-PROMPT.md',
  'docs/multi-event/ENVIRONMENTAL-EVENT-EXTENSIBILITY-REPORT.md',
]
for (const f of requiredFiles) check(`file:${f}`, existsSync(resolve(ROOT, f)), 'missing')

// ── 2. Single manifest per event ────────────────────────────────────────────
check(
  'manifest:thermal-uses-define',
  read('src/events/thermal-activity/event.manifest.ts').includes('defineEnvironmentalEvent('),
)
check(
  'manifest:synthetic-uses-define',
  read('src/events/synthetic-framework-test/event.manifest.ts').includes('defineEnvironmentalEvent('),
)

// ── 3. Runtime discipline: thermal enabled, synthetic registered but disabled ─
check('registry:thermal-enabled', JSON.stringify(environmentalEventRegistry.enabledTypes()) === JSON.stringify(['thermal_activity']))
check('registry:synthetic-auto-registered', environmentalEventRegistry.has('synthetic_framework_test'))
check('registry:synthetic-disabled-in-runtime', !environmentalEventRegistry.isEnabled('synthetic_framework_test'))
check('registry:flood-not-active', !environmentalEventRegistry.has('flood'))

// ── 4. Every registered type is complete via its manifest ───────────────────
for (const def of environmentalEventRegistry.list()) {
  const folder = def.type.replace(/_/g, '-')
  check(`type:${def.type}:presentation`, def.presentation?.eventType === def.type)
  check(`type:${def.type}:map-renderer`, def.mapRenderer?.eventType === def.type)
  check(`type:${def.type}:priority-provider`, def.priorityProvider?.eventType === def.type)
  check(`type:${def.type}:report-adapter`, def.reportAdapter?.eventType === def.type)
  check(`type:${def.type}:source`, def.sources.length > 0)
  check(`type:${def.type}:detail-sections`, def.detailSections.length > 0)
  check(`type:${def.type}:geometry-kinds`, def.geometryKinds.length > 0)
  check(`type:${def.type}:finding-rules`, environmentalEventRegistry.getFindingRules(def.type).length > 0)
  check(`type:${def.type}:methodology`, Boolean(def.methodology))
  check(`type:${def.type}:limitations`, def.limitations.length > 0)
  check(`type:${def.type}:permissions`, Boolean(def.permissions?.view))
  // Server wiring resolved by convention (no db import here).
  check(`type:${def.type}:server-plugin`, existsSync(resolve(ROOT, `server/events/${folder}.server.ts`)))
}

// ── 5. Reusable rules registered once, activated by id ──────────────────────
const reusableIds = [
  'EVENT_NEAR_POPULATION',
  'EVENT_NEAR_PROTECTED_AREA',
  'EVENT_NEAR_ROAD',
  'EVENT_INSIDE_CROPLAND',
  'EVENT_WITH_BIODIVERSITY_CONTEXT',
  'EVENT_EXPANDING',
  'EVENT_PERSISTENT',
  'MULTIPLE_SOURCES_AGREE',
]
for (const id of reusableIds) {
  check(`reusable-rule:${id}`, Boolean(environmentalFindingRuleRegistry.get(id)))
}

// ── 6. Auto-registration: generated indexes are in sync ─────────────────────
check(
  'auto-register:manifests-index-in-sync',
  readFileSync(MANIFESTS_INDEX, 'utf8') === generateManifestsIndex(),
  'run npm run event:sync',
)
check(
  'auto-register:server-index-in-sync',
  readFileSync(SERVER_INDEX, 'utf8') === generateServerIndex(),
  'run npm run event:sync',
)

// ── 7. Generator + validation commands exist ────────────────────────────────
const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> }
for (const s of ['event:new', 'event:sync', 'event:validate', 'event:test']) {
  check(`script:${s}`, Boolean(pkg.scripts[s]))
}
check('generator:scaffolds-disabled', read('scripts/event-new.ts').includes('enabledByDefault: false'))
check('generator:dev-errors', read('scripts/event-new.ts').includes("throw new Error('DEV:"))

// ── 8. No central per-type edits: Situación Nacional / reports / map / API ───
const noBranch = [
  'src/modules/environmental-events/national-situation/event-type-summary.ts',
  'src/modules/environmental-events/ui/event-ui.ts',
  'src/modules/environmental-events/api/environmental-events.api.ts',
  'src/modules/environmental-events/hooks/useEnvironmentalEvents.ts',
]
for (const f of noBranch) {
  check(`no-scatter:${f}`, !/eventType\s*===/.test(read(f)))
}
check(
  'service:manifest-driven-summary',
  read('server/services/environmental-events.service.ts').includes('listEnabled()') &&
    !read('server/services/environmental-events.service.ts').includes("=== 'thermal_activity'"),
)

// ── 9. Extensibility metric: ≤2 central files touched for the synthetic type ─
const CENTRAL_DIRS = [
  'src/modules/environmental-events',
  'server/services',
  'server/routes',
]
const allowedCentral = new Set([
  resolve(ROOT, 'src/modules/environmental-events/types/taxonomy.ts'),
  resolve(ROOT, 'src/modules/environmental-events/types/environmental-event.types.ts'),
])
function walk(dir: string): string[] {
  const abs = resolve(ROOT, dir)
  if (!existsSync(abs)) return []
  const out: string[] = []
  for (const name of readdirSync(abs)) {
    const p = join(abs, name)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walk(join(dir, name)))
    else if (name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.generated.ts')) out.push(p)
  }
  return out
}
const centralHits: string[] = []
for (const dir of CENTRAL_DIRS) {
  for (const file of walk(dir)) {
    if (readFileSync(file, 'utf8').includes('synthetic_framework_test')) centralHits.push(file)
  }
}
const disallowedHits = centralHits.filter((f) => !allowedCentral.has(f))
check('extensibility:synthetic-central-files<=2', centralHits.length <= 2, `${centralHits.length} archivos`)
check(
  'extensibility:synthetic-only-type-files',
  disallowedHits.length === 0,
  disallowedHits.map((f) => f.replace(ROOT, '.')).join(', '),
)

// ── 10. Thermal parity — mapper preserves numbers ───────────────────────────
const sample: FireEventListItemDto = {
  id: '99999999-9999-4999-8999-999999999999',
  department_code: 'GT01',
  department_name: 'Petén',
  status: 'active',
  validation_status: 'probable',
  risk_level: 'atencion',
  priority_score: 55,
  centroid_lat: 16.1,
  centroid_lng: -89.5,
  first_detected_at: '2026-07-09T10:00:00.000Z',
  last_detected_at: '2026-07-09T14:00:00.000Z',
  persistence_hours: 4,
  detection_count: 9,
  satellite_count: 2,
  source_products: ['VIIRS_SNPP_NRT', 'MODIS_NRT'],
  max_frp_mw: 30,
  geometry_method: 'convex_hull_buffer',
  cross_department: false,
  created_at: '2026-07-09T10:05:00.000Z',
}
const mapped = mapFireEventToEnvironmentalEvent(sample)
check('parity:id', mapped.id === sample.id)
check('parity:detection-count', mapped.attributes.detectionCount === sample.detection_count)
check('parity:max-frp', mapped.attributes.maxFrp === sample.max_frp_mw)
check('parity:geometry', JSON.stringify(mapped.geometry) === JSON.stringify({ type: 'Point', coordinates: [-89.5, 16.1] }))
check('parity:classification-operational', mapped.classification === 'operational')
const q = toFireEventsQuery({ page: 2, limit: 20, status: 'resolved' })
check('parity:query-offset', q.offset === 20 && q.limit === 20 && q.status === 'closed')

// ── 11. Generic API validates auth on every endpoint ────────────────────────
const routesSrc = read('server/routes/environmental-events.ts')
const guardCount = (routesSrc.match(/runOperationalGuard/g) ?? []).length
check('api:auth-guard-all', guardCount >= 3, `found ${guardCount}`)
check('api:permission', routesSrc.includes("permission: 'incidents.view'"))
check('api:hides-disabled-types', routesSrc.includes('enabledTypes()'))

// ── 12. Legacy thermal routes not broken ────────────────────────────────────
const indexSrc = read('server/index.ts')
check('legacy:fire-routes-wired', indexSrc.includes('handleFireRoutes'))
check('legacy:generic-routes-wired', indexSrc.includes('handleEnvironmentalEventsRoutes'))
const registrySrc = read('server/auth/route-registry.ts')
check('legacy:fire-registry', registrySrc.includes("path: '/api/environment/fires/*'"))
check('legacy:generic-registry', registrySrc.includes("path: '/api/environmental-events/*'"))

// ── 13. Language discipline (thermal presentation is Spanish) ───────────────
const englishLeak = /\b(hotspot|wildfire|Fire event|Loading|Status:)\b/
check('language:presentation-es', !englishLeak.test(read('src/modules/environmental-events/thermal/thermal-presentation.adapter.ts')))
check('language:disclaimer', read('src/modules/environmental-events/thermal/thermal-map-renderer.ts').includes('THERMAL_SCIENTIFIC_DISCLAIMER'))

console.log('')
console.log(`environmental-event-framework:audit — ${passes.length} passed, ${failures.length} failed`)
console.log('')
for (const p of passes) console.log(`  ✓ ${p}`)
for (const f of failures) console.log(`  ✗ ${f}`)

if (failures.length > 0) {
  console.log('')
  process.exit(1)
}

console.log('')
console.log('Environmental Event Framework — extensibility factory audit OK')
