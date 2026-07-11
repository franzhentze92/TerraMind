/**
 * event:sync — regenerate the single registration indexes.
 *
 * Scans src/events/<type>/event.manifest.ts and server/events/<type>.server.ts
 * by convention and (re)writes:
 *   - src/events/manifests.generated.ts  (client-safe manifest list)
 *   - server/events/server.generated.ts  (server-only plugin wiring)
 *
 * Run automatically by `event:new`. The framework audit uses `--check` to fail
 * when the indexes are stale, so adding a plugin never means hand-editing a
 * central registry.
 *
 * Usage:
 *   tsx scripts/event-sync.ts            # write indexes
 *   tsx scripts/event-sync.ts --check    # exit 1 if out of date
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import {
  MANIFESTS_INDEX,
  SERVER_INDEX,
  generateManifestsIndex,
  generateServerIndex,
} from './lib/event-index.js'

function main(): void {
  const check = process.argv.includes('--check')
  const targets = [
    { path: MANIFESTS_INDEX, content: generateManifestsIndex(), label: 'src/events/manifests.generated.ts' },
    { path: SERVER_INDEX, content: generateServerIndex(), label: 'server/events/server.generated.ts' },
  ]

  let stale = false
  for (const t of targets) {
    const current = existsSync(t.path) ? readFileSync(t.path, 'utf8') : ''
    if (current === t.content) continue
    if (check) {
      stale = true
      console.error(`[event:sync] Desactualizado: ${t.label}`)
    } else {
      writeFileSync(t.path, t.content, 'utf8')
      console.log(`[event:sync] Escrito: ${t.label}`)
    }
  }

  if (check) {
    if (stale) {
      console.error('[event:sync] Ejecuta `npm run event:sync` para regenerar los índices.')
      process.exit(1)
    }
    console.log('[event:sync] Índices al día.')
  } else {
    console.log('[event:sync] Sincronización completa.')
  }
}

main()
