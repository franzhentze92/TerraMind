import { config } from 'dotenv'
import { resolve } from 'node:path'
import { importGuatemalaProtectedAreas } from '@/pipeline/geo/import-guatemala-protected-areas'
import { countTerritorialFeatures } from '@/pipeline/stores/territorial.store'
import { CONAP_SIGAP_LAYER_CODE } from '@/pipeline/geo/conap-sigap'

config({ path: resolve(process.cwd(), '.env') })

async function runValidation() {
  const count = await countTerritorialFeatures(CONAP_SIGAP_LAYER_CODE)
  console.log('\n🔎 Validación post-importación')
  console.log(`   Features únicas en BD: ${count}`)
}

async function main() {
  if (!process.env.SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error('❌ SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridas.')
    process.exit(1)
  }

  console.log('🌿 Importación áreas protegidas SIGAP — CONAP 2025 (Commit 7A.1)')
  await importGuatemalaProtectedAreas()
  await runValidation()
}

main().catch((err) => {
  console.error('❌ Error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
