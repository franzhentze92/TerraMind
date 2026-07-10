import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(
      `${name} no configurada. Agregue la variable al archivo .env del servidor.`,
    )
  }
  return value
}

/**
 * Cliente Supabase server-side con service role.
 * NUNCA importar desde código frontend.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client

  const url = requireEnv('SUPABASE_URL')
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  if (serviceKey.startsWith('VITE_')) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY no debe usar prefijo VITE_.')
  }

  client = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return client
}

/** Para tests — resetea singleton */
export function resetSupabaseClient(): void {
  client = null
}
