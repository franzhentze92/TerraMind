import 'dotenv/config'
import { runLandCoverAudit } from '@/modules/territory/land-cover/audit/land-cover-audit'

async function main(): Promise<void> {
  console.log('🔍 Auditoría cobertura del suelo — Guatemala (7A.2-C)')
  const report = await runLandCoverAudit()
  console.log(
    JSON.stringify(
      {
        event: 'land_cover_audit_complete',
        boundary: report.boundary,
        national_distribution: report.nationalDistribution,
        class_integrity: report.classIntegrity,
        manual_spot_checks: report.manualSpotChecks,
        manual_spot_check_warnings: report.manualSpotCheckWarnings,
      },
      null,
      2,
    ),
  )
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ event: 'land_cover_audit_error', message }))
  process.exit(1)
})
