#!/usr/bin/env npx tsx
/**
 * Rainfall deficit — activation readiness audit.
 *
 * Reports the gating criteria for enabling the `rainfall_deficit` feature flag.
 * Does NOT enable anything and does NOT commit. Exit code 0 when ready.
 *
 *   npm run rainfall-deficit:activation-audit
 *   npm run rainfall-deficit:activation-audit -- --probe-source
 */
import { probeChirpsUrl } from '@/modules/precipitation/chirps-v3/chirps-v3.download'
import { chirpsPentadTifUrl } from '@/modules/precipitation/chirps-v3/chirps-v3.urls'
import { toPentadRef } from '@/modules/precipitation/chirps-v3/chirps-pentad.calendar'
import { resolveActivationReadiness } from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.activation'

async function main() {
  const probeSource = process.argv.includes('--probe-source')
  console.log('=== Rainfall Deficit — Activation Readiness Audit ===\n')

  const readiness = resolveActivationReadiness()

  for (const c of readiness.checks) {
    const mark = c.passed ? 'PASS' : 'FAIL'
    console.log(`[${mark}] ${c.label}\n        ${c.detail}`)
  }

  if (probeSource) {
    try {
      const ref = toPentadRef(2020, 7, 2)
      const url = chirpsPentadTifUrl(ref, 'final')
      const probe = await probeChirpsUrl(url)
      console.log(
        `[${probe.ok ? 'PASS' : 'FAIL'}] Fuente CHIRPS v3 alcanzable\n        ${url} → ok=${probe.ok} bytes=${probe.contentLength ?? '—'}`,
      )
    } catch (err) {
      console.log(`[FAIL] Fuente CHIRPS v3 alcanzable\n        ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  console.log('\n--- Resumen ---')
  console.log(JSON.stringify(readiness.summary, null, 2))
  console.log(`\nESTADO: ${readiness.ready ? 'LISTO PARA ACTIVACIÓN (flag)' : 'NO LISTO — faltan criterios'}`)
  console.log(
    readiness.ready
      ? 'Para activar en desarrollo: EVENT_FLAG_RAINFALL_DEFICIT=1'
      : 'Completa los criterios FAIL antes de activar el flag.',
  )

  process.exit(readiness.ready ? 0 : 1)
}

main().catch((err) => {
  console.error('activation-audit failed:', err instanceof Error ? err.message : err)
  process.exit(2)
})
