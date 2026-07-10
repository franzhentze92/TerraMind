/**
 * Store de biodiversidad — lectura/escritura contra Supabase.
 * La migración 010 debe aplicarse antes de persistir ocurrencias.
 */

export async function checkBiodiversityDatabaseReachable(): Promise<boolean> {
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? process.env.SUPABASE_ANON_KEY?.trim()
  if (!url || !key) return false

  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/biodiversity_sources?select=id&limit=1`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    })
    if (response.status === 404 || response.status === 406) return false
    return response.ok
  } catch {
    return false
  }
}

export interface BiodiversityFetchRunInput {
  provider: string
  queryHash: string
  status: 'running' | 'completed' | 'failed'
  recordsReceived?: number
  recordsInserted?: number
  recordsUpdated?: number
  recordsRejected?: number
  errorCode?: string
  safeErrorMessage?: string
  metrics?: Record<string, unknown>
}

/** Placeholder para futura persistencia post-migración. */
export async function createBiodiversityFetchRun(_input: BiodiversityFetchRunInput): Promise<string | null> {
  return null
}

export async function completeBiodiversityFetchRun(
  _id: string,
  _input: Partial<BiodiversityFetchRunInput>,
): Promise<void> {
  // No-op hasta aplicar migración 010
}
