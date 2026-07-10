import type { FieldFormSchemaRecord } from '@/modules/field-operations/field-forms/field-form.types'
import type { LocalOfflinePackageRecord } from '@/modules/field-operations/offline-packages/offline-package.repository'

export function ReadOnlyContextPanel({
  pkg,
  task,
  schema,
}: {
  pkg: LocalOfflinePackageRecord
  task: Record<string, unknown>
  schema: FieldFormSchemaRecord
}) {
  const missionPayload = pkg.payloads.find((p) => p.path === 'mission.json')
  const instructionsPayload = pkg.payloads.find((p) => p.path === 'instructions.json')
  let mission: Record<string, unknown> = {}
  let instructions: Record<string, unknown> = {}
  try {
    if (missionPayload) mission = JSON.parse(missionPayload.content) as Record<string, unknown>
    if (instructionsPayload) instructions = JSON.parse(instructionsPayload.content) as Record<string, unknown>
  } catch {
    /* ignore */
  }

  return (
    <aside className="mb-4 rounded-lg border border-border-subtle bg-surface-2/20 p-3 text-xs text-text-secondary">
      <p className="font-medium text-text-primary">Contexto de misión (solo lectura)</p>
      <p className="mt-1">{String(mission.objective ?? pkg.mission_title)}</p>
      <p className="mt-2 text-text-tertiary">Tarea: {String(task.title)}</p>
      <p className="text-text-tertiary">Schema: {schema.schema_id} v{schema.schema_version}</p>
      {typeof instructions.general === 'string' && (
        <p className="mt-2">{instructions.general}</p>
      )}
    </aside>
  )
}
