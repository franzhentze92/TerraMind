#!/usr/bin/env tsx
import { downloadWorldPopRasters } from '@/modules/territory/population/processing/download'

async function main() {
  const result = await downloadWorldPopRasters()
  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
