#!/usr/bin/env tsx
import { benchmarkWorldPop } from '@/modules/territory/population/processing/benchmark'

async function main() {
  const report = await benchmarkWorldPop()
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
