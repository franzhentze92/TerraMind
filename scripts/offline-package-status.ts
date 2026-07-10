import { config } from 'dotenv'
import { resolve } from 'node:path'

import { listPendingOfflinePackageJobs } from '@/pipeline/stores/offline-package-jobs.store'
import { listOfflinePackagesForMission } from '@/pipeline/stores/offline-mission-packages.store'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

config({ path: resolve(process.cwd(), '.env') })

const supabase = getSupabaseAdmin()
const { data: packages, error } = await supabase
  .from('offline_mission_packages')
  .select('status')
if (error) throw new Error(error.message)

const counts: Record<string, number> = {}
for (const row of packages ?? []) {
  const status = String(row.status)
  counts[status] = (counts[status] ?? 0) + 1
}

const jobs = await listPendingOfflinePackageJobs(50)

console.log(
  JSON.stringify(
    {
      package_status_counts: counts,
      pending_jobs: jobs.length,
      jobs,
      generated_at: new Date().toISOString(),
    },
    null,
    2,
  ),
)

if (process.argv[2]) {
  const missionPackages = await listOfflinePackagesForMission(process.argv[2])
  console.log(JSON.stringify({ mission_packages: missionPackages }, null, 2))
}
