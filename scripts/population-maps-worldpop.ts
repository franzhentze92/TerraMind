#!/usr/bin/env tsx
import { generateWorldPopDiagnosticMaps } from '@/modules/territory/population/processing/diagnostic-maps'

async function main() {
  const results = await generateWorldPopDiagnosticMaps()
  console.log(JSON.stringify(results, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
