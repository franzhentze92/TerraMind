import { config } from 'dotenv'
import { resolve } from 'node:path'

import { requestOfflinePackageGeneration } from '@/pipeline/engines/field-operations/offline-package.runner'

config({ path: resolve(process.cwd(), '.env') })

const missionId = process.argv[2]
const idempotencyKey = process.argv[3] ?? `cli-${Date.now()}`

if (!missionId) {
  console.error('Uso: npm run offline-packages:generate -- <mission_id> [idempotency_key]')
  process.exit(1)
}

const result = await requestOfflinePackageGeneration({
  missionId,
  actorId: 'cli',
  idempotencyKey,
})

console.log(JSON.stringify(result, null, 2))
