#!/usr/bin/env tsx
import { config } from 'dotenv'
import { resolve } from 'node:path'

import { parseCliArgs } from '@/modules/territory/population/cli/population-cli-utils'
import { seedPopulationAdminToSupabase } from '@/modules/territory/population/providers/ine/population-supabase-seed'

config({ path: resolve(process.cwd(), '.env') })

async function main() {
  const args = parseCliArgs(process.argv.slice(2))
  const apply = args.apply === 'true' || process.argv.includes('--apply')
  const report = await seedPopulationAdminToSupabase(apply ? 'apply' : 'dry-run')
  console.log(JSON.stringify(report, null, 2))
  if (!apply) {
    console.error('\nDry-run. Para aplicar: npm run population:seed-supabase -- --apply')
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
