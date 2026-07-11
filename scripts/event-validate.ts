/**
 * event:validate — validate a single event plugin end to end.
 *
 * Usage: tsx scripts/event-validate.ts thermal_activity
 *        npm run event:validate -- thermal_activity
 *
 * Checks manifest completeness, typed adapters, sources, renderer/geometry
 * compatibility, finding rules, priority provider, methodology, limitations,
 * report adapter, permissions, feature flag, server wiring, spec presence and a
 * light Spanish-copy heuristic. Does NOT execute server/supabase code.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import '@/modules/environmental-events'
import { environmentalEventRegistry } from '@/modules/environmental-events/registry/event-type-registry'
import { environmentalFindingRuleRegistry } from '@/modules/environmental-events/registry/finding-rule-registry'
import { isEnvironmentalEventType } from '@/modules/environmental-events/types/taxonomy'

const ROOT = process.cwd()
let failures = 0
let warnings = 0

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    console.log(`  ✓ ${name}`)
  } else {
    failures++
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function warn(name: string, ok: boolean, detail = ''): void {
  if (!ok) {
    warnings++
    console.warn(`  ! ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const ENGLISH_HINTS = [' the ', ' and ', ' event ', ' fire ', ' with ', ' near ']

function main(): void {
  const type = process.argv.slice(2).find((a) => !a.startsWith('--'))
  if (!type) {
    console.error('[event:validate] Falta el tipo: npm run event:validate -- <type>')
    process.exit(1)
  }
  if (!isEnvironmentalEventType(type)) {
    console.error(`[event:validate] Tipo no reconocido: "${type}"`)
    process.exit(1)
  }

  console.log(`[event:validate] Validando "${type}"...`)
  environmentalEventRegistry.setIncludeDisabled(true)

  check('registrado en el registry', environmentalEventRegistry.has(type))
  if (!environmentalEventRegistry.has(type)) process.exit(1)

  const m = environmentalEventRegistry.get(type)
  const folder = type.replace(/_/g, '-')

  check('manifest.type coincide', m.type === type)
  check('label y pluralLabel', Boolean(m.label && m.pluralLabel))
  check('icon', Boolean(m.icon))
  check('geometryKinds declaradas', m.geometryKinds.length > 0)
  check('al menos una fuente', m.sources.length > 0)
  check('presentation.eventType', m.presentation.eventType === type)
  check('mapRenderer.eventType', m.mapRenderer.eventType === type)
  check('priorityProvider.eventType', m.priorityProvider.eventType === type)
  check('priorityProviderId', Boolean(m.priorityProviderId))
  check('reportAdapter.eventType', m.reportAdapter.eventType === type)
  check(
    'renderer compatible con geometrías del manifest',
    m.geometryKinds.some((g) => m.mapRenderer.supportedGeometryKinds.includes(g)),
  )
  check('detailSections', m.detailSections.length > 0)
  check('methodology', Boolean(m.methodology))
  check('limitations', m.limitations.length > 0)
  check('permissions.view', Boolean(m.permissions?.view))
  check('runtime.featureFlag', Boolean(m.runtime?.featureFlag))

  const unresolved = m.findingRuleIds.filter((id) => !environmentalFindingRuleRegistry.get(id))
  check('finding rules reutilizables resolubles', unresolved.length === 0, unresolved.join(', '))

  check(
    'priority provider expone las 6 dimensiones',
    ['getSeverityFactors', 'getExposureFactors', 'getPersistenceFactors', 'getSensitivityFactors', 'getUncertaintyFactors', 'getUrgencyFactors'].every(
      (fn) => typeof (m.priorityProvider as unknown as Record<string, unknown>)[fn] === 'function',
    ),
  )

  const legend = m.mapRenderer.getLegendDefinition()
  check('leyenda de mapa', Boolean(legend?.title))

  // Server wiring by convention (checked on disk; no server code executed).
  const serverFile = resolve(ROOT, 'server/events', `${folder}.server.ts`)
  check('server plugin presente', existsSync(serverFile), serverFile.replace(ROOT, '.'))
  const serverIndex = resolve(ROOT, 'server/events/server.generated.ts')
  check(
    'server plugin en el índice generado',
    existsSync(serverIndex) && readFileSync(serverIndex, 'utf8').includes(`./${folder}.server.js`),
  )

  // Spec presence (warning only).
  const specYaml = resolve(ROOT, 'src/events/specs', `${type}.event.yaml`)
  const specJson = resolve(ROOT, 'src/events/specs', `${type}.event.json`)
  warn('spec declarativa presente', existsSync(specYaml) || existsSync(specJson))

  // Classification / runtime discipline.
  check(
    'clasificación de runtime coherente (disabled sin habilitar por defecto salvo producto)',
    m.runtime.enabledByDefault ? m.type === 'thermal_activity' : true,
  )

  // Light Spanish-copy heuristic (warning only).
  const copy = ` ${m.label} ${m.pluralLabel} ${m.description} ${m.methodology} `.toLowerCase()
  warn('copy en español (heurística)', !ENGLISH_HINTS.some((h) => copy.includes(h)))

  console.log('')
  if (failures > 0) {
    console.error(`[event:validate] ${type}: ${failures} fallo(s), ${warnings} aviso(s). ✗`)
    process.exit(1)
  }
  console.log(`[event:validate] ${type}: OK (${warnings} aviso(s)). ✓`)
}

main()
