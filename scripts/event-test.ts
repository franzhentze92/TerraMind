/**
 * event:test — run ONLY the tests relevant to one event plugin.
 *
 * Usage: tsx scripts/event-test.ts thermal_activity
 *        npm run event:test -- thermal_activity
 *
 * Runs the plugin's own test, the shared framework contracts, the generic UI
 * builders and the declarative spec suite. For thermal it also runs the parity
 * suite.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = process.cwd()

function main(): void {
  const type = process.argv.slice(2).find((a) => !a.startsWith('--'))
  if (!type) {
    console.error('[event:test] Falta el tipo: npm run event:test -- <type>')
    process.exit(1)
  }
  const folder = type.replace(/_/g, '-')

  const candidates = [
    `src/events/${folder}/event.test.ts`,
    'src/modules/environmental-events/environmental-events.test.ts',
    'src/modules/environmental-events/ui/event-ui.test.ts',
    'src/modules/environmental-events/spec/event-spec.test.ts',
  ]
  if (type === 'thermal_activity') {
    candidates.push('src/modules/environmental-events/environmental-events.parity.test.ts')
  }

  const paths = candidates.filter((p) => existsSync(resolve(ROOT, p)))
  if (paths.length === 0) {
    console.error(`[event:test] No hay tests para "${type}".`)
    process.exit(1)
  }

  console.log(`[event:test] Ejecutando tests de "${type}":`)
  for (const p of paths) console.log('  - ' + p)

  const result = spawnSync('npx', ['vitest', 'run', ...paths], {
    stdio: 'inherit',
    shell: true,
    cwd: ROOT,
  })
  process.exit(result.status ?? 1)
}

main()
