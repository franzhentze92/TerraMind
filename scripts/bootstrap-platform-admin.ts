#!/usr/bin/env tsx
import { config } from 'dotenv'
import { resolve } from 'node:path'

import { runPlatformBootstrap, getBootstrapStatus } from '../server/services/provisioning/bootstrap.service.js'
import { recordAuthAuditEvent } from '../server/services/auth-audit.service.js'

config({ path: resolve(process.cwd(), '.env') })

async function main() {
  const status = getBootstrapStatus()
  if (!status.enabled) {
    console.error('Bootstrap deshabilitado. Configure AUTH_BOOTSTRAP_TOKEN y AUTH_BOOTSTRAP_AUTH_USER_ID.')
    process.exit(1)
  }

  const authUserId = process.argv[2] ?? status.allowed_auth_user_id
  const email = process.argv[3]
  if (!authUserId || !email) {
    console.error('Uso: npm run auth:bootstrap-admin -- <auth_user_id> <email> [display_name]')
    process.exit(1)
  }

  const displayName = process.argv[4]
  const result = await runPlatformBootstrap({
    auth_user_id: authUserId,
    email,
    display_name: displayName,
    bootstrap_token: process.env.AUTH_BOOTSTRAP_TOKEN,
  })

  await recordAuthAuditEvent({
    event_type: 'platform_bootstrap',
    outcome: result.already_completed ? 'denied' : 'allowed',
    metadata: {
      auth_user_id: authUserId,
      organization_id: result.organization_id ?? null,
      already_completed: Boolean(result.already_completed),
    },
  })

  console.log(JSON.stringify({ ...result, bootstrap_status: getBootstrapStatus() }, null, 2))
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
