/**
 * Piloto N2 — analiza 5 noticias variadas con confirmación de costo.
 * Uso: NEWS_LLM_ENABLED=true OPENAI_API_KEY=... npx tsx scripts/news-analysis-pilot.ts [--dry-run]
 */
import 'dotenv/config'
import {
  batchAnalyzeDryRunDto,
  batchAnalyzeDto,
} from '../server/services/news-analysis.service.js'

const PILOT_DOCUMENT_IDS = [
  'fdc28747-dada-42e9-b54b-4f3fc072fbb3', // judicial zona 15
  '6223f448-2df3-4e93-93c4-d4aaf4f8a69e', // nacional (clima)
  '97a401e7-523e-4ae8-9cce-3d45147e43e3', // internacional
  'cb1633bb-e4e0-466a-95e7-1754c2a5fb8c', // infraestructura/movilidad
  'c1419ac9-a64e-4374-a747-2c2f26e9a2e5', // salud (sarampión)
]

const dryRunOnly = process.argv.includes('--dry-run')

async function main() {
  const dry = await batchAnalyzeDryRunDto({
    documentIds: PILOT_DOCUMENT_IDS,
    limit: 5,
    modelTier: 'fast',
  })

  console.log('=== PILOTO N2 — DRY RUN ===')
  console.log(JSON.stringify(dry, null, 2))

  if (dryRunOnly) return

  if (process.env.NEWS_LLM_ENABLED !== 'true' || !process.env.OPENAI_API_KEY) {
    console.error('NEWS_LLM_ENABLED=true y OPENAI_API_KEY son requeridos para ejecutar el piloto.')
    process.exit(1)
  }

  const result = await batchAnalyzeDto(
    { authUserId: 'pilot', userId: 'pilot', activeOrganizationId: '', membershipId: '', roles: ['platform_admin'], permissions: ['news.analysis.run'], isPlatformAdmin: true } as never,
    {
      documentIds: PILOT_DOCUMENT_IDS,
      limit: 5,
      modelTier: 'fast',
      estimatedCostConfirmation: true,
    },
  )

  console.log('=== PILOTO N2 — RESULTADO ===')
  console.log(JSON.stringify(result, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
