import { FieldFormRenderer } from '@/modules/field-operations/field-forms/components/FieldFormRenderer'
import { ReadOnlyContextPanel } from '@/modules/field-operations/field-forms/components/ReadOnlyContextPanel'
import { useFieldFormTask } from '@/modules/field-operations/field-forms/hooks/useFieldForm'
import { LocalEvidencePanel } from '@/modules/field-operations/offline-evidence/components/LocalEvidencePanel'
import type { LocalOfflinePackageRecord } from '@/modules/field-operations/offline-packages/offline-package.repository'

export function FieldTaskFormView({
  pkg,
  task,
}: {
  pkg: LocalOfflinePackageRecord
  task: Record<string, unknown>
}) {
  const form = useFieldFormTask(pkg, task, 'es')

  if (form.loading) return <p className="text-sm text-text-tertiary">Cargando formulario…</p>
  if (form.error) return <p className="text-sm text-confidence-low">{form.error}</p>
  if (!form.schema || !form.response) return null

  return (
    <div className="mx-auto max-w-2xl p-4 pb-24">
      <ReadOnlyContextPanel pkg={pkg} task={task} schema={form.schema} />
      <h1 className="mb-2 text-lg font-medium text-text-primary">{String(task.title)}</h1>
      <p className="mb-4 text-sm text-text-secondary">{String(task.instructions)}</p>

      <FieldFormRenderer
        schema={form.schema}
        answers={form.answers}
        visibleFields={form.validation?.visible_fields ?? []}
        readOnly={form.readOnly}
        locale={form.locale}
        onChange={form.updateField}
        errors={form.validation?.errors ?? []}
      />

      {form.validation && form.validation.warnings.length > 0 && (
        <div className="mt-4 rounded border border-confidence-medium/30 bg-surface-2/30 p-3 text-xs text-confidence-medium">
          <p className="font-medium">{form.translateUi('warnings')}</p>
          <ul className="mt-1 list-disc pl-4">
            {form.validation.warnings.map((w) => (
              <li key={w.code}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 border-t border-border-subtle bg-surface-1/95 p-4 md:static md:mt-6 md:border-0 md:bg-transparent md:p-0">
        {form.lastSaved && (
          <p className="mb-2 text-xs text-text-tertiary">
            {form.translateUi('last_saved')}: {new Date(form.lastSaved).toLocaleString()}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {!form.readOnly && (
            <>
              <button
                type="button"
                onClick={() => void form.saveDraftNow()}
                className="rounded border border-border-subtle px-4 py-2 text-sm"
              >
                {form.translateUi('save_draft')}
              </button>
              <button
                type="button"
                onClick={() => void form.finalize(form.validation?.warnings.length ? true : false)}
                className="rounded border border-accent/40 px-4 py-2 text-sm text-accent"
              >
                {form.translateUi('finalize')}
              </button>
            </>
          )}
          {form.readOnly && (
            <button
              type="button"
              onClick={() => void form.revise('Corrección operacional')}
              className="rounded border border-border-subtle px-4 py-2 text-sm"
            >
              {form.translateUi('create_revision')}
            </button>
          )}
        </div>
      </div>

      <LocalEvidencePanel pkg={pkg} taskId={String(task.id)} />
    </div>
  )
}
