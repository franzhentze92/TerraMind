/**
 * Importa límites HDX COD-AB (Guatemala ADM0 + 22 ADM1).
 * Uso: npm run geo:import-guatemala
 */
import { config } from 'dotenv'
import { resolve } from 'node:path'
import { importGuatemalaBoundaries } from '@/pipeline/geo/import-guatemala'

config({ path: resolve(process.cwd(), '.env') })

async function main() {
  if (!process.env.SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error('❌ SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridas.')
    process.exit(1)
  }

  console.log('🌎 Importación geográfica HDX COD-AB (Commit 3A)')
  console.log('   Fuente: data/geo/sources/hdx-cod-ab-guatemala/2025-10-30-v01/')
  await importGuatemalaBoundaries()
}

main().catch((err) => {
  console.error('❌ Error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
