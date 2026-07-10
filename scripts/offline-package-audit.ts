import { config } from 'dotenv'
import { resolve } from 'node:path'

import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

config({ path: resolve(process.cwd(), '.env') })

const supabase = getSupabaseAdmin()
const limit = Number(process.argv[2] ?? 50)

const { data: events, error } = await supabase
  .from('offline_package_events')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(limit)

if (error) throw new Error(error.message)

console.log(JSON.stringify({ events: events ?? [], generated_at: new Date().toISOString() }, null, 2))
