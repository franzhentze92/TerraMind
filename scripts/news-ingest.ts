import { config } from 'dotenv'
import { resolve } from 'node:path'
import {
  inspectNewsSource,
  reprocessSourceAnalysis,
  runNewsIngestion,
} from '../server/services/news-ingestion.service'
import { getNewsConnector } from '../src/modules/news/connectors/registry'
import { getNewsSourceByCode, mapSourceRow } from '../src/pipeline/stores/news.store'

config({ path: resolve(process.cwd(), '.env') })

const mode = process.argv[2] ?? 'ingest'
const sourceCode = process.argv[3] ?? 'prensa_libre_gt'

async function dryRunDiscover(code: string) {
  const row = await getNewsSourceByCode(code)
  if (!row) throw new Error(`Fuente no registrada: ${code}`)
  const source = mapSourceRow(row)
  const connector = getNewsConnector(code)
  const inspection = await connector.inspectSource(source)
  const discovered = await connector.discoverDocuments(source)
  const published = discovered
    .map((d) => d.publishedAt)
    .filter((v): v is string => Boolean(v))
    .sort()
  const byCategory: Record<string, number> = {}
  for (const item of discovered) {
    const key = item.sourceCategory ?? 'sin_categoria'
    byCategory[key] = (byCategory[key] ?? 0) + 1
  }
  return {
    sourceCode: code,
    inspection: {
      selectedDiscoveryMethod: inspection.selectedDiscoveryMethod,
      discoveryJustification: inspection.discoveryJustification,
      feedUrlsAllowed: inspection.feedUrlsAllowed,
      canonicalDomain: inspection.canonicalDomain,
      accessRestrictions: inspection.accessRestrictions,
    },
    discovered: discovered.length,
    categoryDistribution: byCategory,
    publishedRange: {
      min: published[0] ?? null,
      max: published.at(-1) ?? null,
    },
    sample: discovered.slice(0, 5).map((d) => ({
      title: d.title,
      url: d.discoveredUrl,
      publishedAt: d.publishedAt ?? null,
      category: d.sourceCategory ?? null,
    })),
  }
}

async function main() {
  if (mode === 'inspect') {
    const report = await inspectNewsSource(sourceCode)
    console.log(JSON.stringify(report, null, 2))
    return
  }

  if (mode === 'dry-run' || mode === 'estimate') {
    const report = await dryRunDiscover(sourceCode)
    console.log(JSON.stringify(report, null, 2))
    return
  }

  if (mode === 'reprocess') {
    const result = await reprocessSourceAnalysis(sourceCode)
    console.log(JSON.stringify(result, null, 2))
    return
  }

  const result = await runNewsIngestion(sourceCode)
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
