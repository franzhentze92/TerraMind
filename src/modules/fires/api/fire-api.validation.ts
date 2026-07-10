import { z } from 'zod'
import { FIRMS_INGEST_SOURCES } from '@/pipeline/connectors/firms.config'
import { FIRE_EVENTS_MAX_LIMIT } from '@/modules/fires/config/fire.constants'

const isoDateSchema = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Fecha ISO inválida' })

export const fireRiskLevelSchema = z.enum([
  'informativo',
  'observacion',
  'atencion',
  'alto',
  'critico',
])

export const fireEventStatusSchema = z.enum(['new', 'active', 'monitoring', 'closed'])

export const fireValidationStatusSchema = z.enum([
  'no_validado',
  'probable',
  'confirmado',
])

export const fireEventsQuerySchema = z.object({
  since: isoDateSchema.optional(),
  until: isoDateSchema.optional(),
  department_code: z.string().min(1).max(32).optional(),
  risk_level: fireRiskLevelSchema.optional(),
  status: fireEventStatusSchema.optional(),
  validation_status: fireValidationStatusSchema.optional(),
  source_product: z.enum(FIRMS_INGEST_SOURCES).optional(),
  min_priority: z.coerce.number().min(0).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(FIRE_EVENTS_MAX_LIMIT).default(25),
  offset: z.coerce.number().int().min(0).default(0),
})

export type FireEventsQuery = z.infer<typeof fireEventsQuerySchema>

export function parseFireEventsQuery(
  searchParams: URLSearchParams,
): { ok: true; data: FireEventsQuery } | { ok: false; error: string } {
  const raw = Object.fromEntries(searchParams.entries())
  const parsed = fireEventsQuerySchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { ok: false, error: first?.message ?? 'Parámetros inválidos' }
  }
  return { ok: true, data: parsed.data }
}

export function computeWindowBounds(
  windowHours: number,
  now: Date = new Date(),
): { window_start_utc: string; window_end_utc: string } {
  const end = now
  const start = new Date(end.getTime() - windowHours * 60 * 60 * 1000)
  return {
    window_start_utc: start.toISOString(),
    window_end_utc: end.toISOString(),
  }
}

export function computeStaleStatus(
  lastSuccessfulIngestionAt: string | null,
  staleAfterMinutes: number,
  now: Date = new Date(),
): boolean {
  if (!lastSuccessfulIngestionAt) return true
  const ageMs = now.getTime() - new Date(lastSuccessfulIngestionAt).getTime()
  return ageMs > staleAfterMinutes * 60 * 1000
}
