#!/usr/bin/env tsx
import { prepareWorldPopCogs } from '@/modules/territory/population/processing/build'

async function main() {
  const results = await prepareWorldPopCogs()
  console.log(JSON.stringify(results, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
