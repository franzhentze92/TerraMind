import { config } from 'dotenv'
import { resolve } from 'node:path'
import {
  inspectNewsSource,
  reprocessSourceAnalysis,
  runNewsIngestion,
} from '../server/services/news-ingestion.service'

config({ path: resolve(process.cwd(), '.env') })

const mode = process.argv[2] ?? 'ingest'

async function main() {
  if (mode === 'inspect') {
    const report = await inspectNewsSource('prensa_libre_gt')
    console.log(JSON.stringify(report, null, 2))
    return
  }

  if (mode === 'reprocess') {
    const result = await reprocessSourceAnalysis('prensa_libre_gt')
    console.log(JSON.stringify(result, null, 2))
    return
  }

  const result = await runNewsIngestion('prensa_libre_gt')
  console.log(
    JSON.stringify(
      {
        run: result.run,
        inspection: result.inspection
          ? {
              selectedDiscoveryMethod: result.inspection.selectedDiscoveryMethod,
              discoveryJustification: result.inspection.discoveryJustification,
              feedUrlsAllowed: result.inspection.feedUrlsAllowed,
              accessRestrictions: result.inspection.accessRestrictions,
            }
          : undefined,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
