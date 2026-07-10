#!/usr/bin/env tsx
import { parseCliArgs, sanitizeJsonForCli } from '@/modules/territory/population/cli/population-cli-utils'
import { runIneImport } from '@/modules/territory/population/providers/ine/ine-import-builder'

async function main() {
  const args = parseCliArgs(process.argv.slice(2))
  const apply = args.apply === 'true' || process.argv.includes('--apply')
  const dryRun = args['dry-run'] === 'true' || process.argv.includes('--dry-run') || !apply

  if (!dryRun && !apply) {
    throw new Error('Especificar --dry-run o --apply')
  }

  const report = runIneImport(dryRun ? 'dry-run' : 'apply')
  console.log(JSON.stringify(sanitizeJsonForCli(report), null, 2))

  if (dryRun) {
    console.error('\nDry-run completado. Para persistir: npm run population:import-ine -- --apply')
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
