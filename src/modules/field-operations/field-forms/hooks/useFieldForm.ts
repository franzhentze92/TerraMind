import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { FieldFormRenderer } from '@/modules/field-operations/field-forms/components/FieldFormRenderer'
import { ReadOnlyContextPanel } from '@/modules/field-operations/field-forms/components/ReadOnlyContextPanel'
import { validateFieldFormAnswers } from '@/modules/field-operations/field-forms/engine/field-form-validator'
import type { FieldFormLocale, FieldFormResponseRecord } from '@/modules/field-operations/field-forms/field-form.types'
import {
  createFieldFormRuntime,
  debounce,
  finalizeForm,
  openTaskForm,
  saveDraft,
  createRevision,
} from '@/modules/field-operations/field-forms/field-form.runtime'
import { FieldFormRepository } from '@/modules/field-operations/field-forms/field-form.repository'
import { translateUi } from '@/modules/field-operations/field-forms/i18n/field-form-i18n'
import type { LocalOfflinePackageRecord } from '@/modules/field-operations/offline-packages/offline-package.repository'

const formRepo = FieldFormRepository.createDefault()

export function useFieldFormTask(
  pkg: LocalOfflinePackageRecord | null,
  task: Record<string, unknown> | null,
  locale: FieldFormLocale = 'es',
) {
  const [response, setResponse] = useState<FieldFormResponseRecord | null>(null)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [error, setError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const runtime = useMemo(
    () => (pkg ? createFieldFormRuntime(pkg, formRepo) : null),
    [pkg],
  )

  const schema = useMemo(() => {
    if (!runtime || !response) return null
    return runtime.registry.get(response.schema_id, response.schema_version)
  }, [runtime, response])

  const validation = useMemo(() => {
    if (!schema) return null
    return validateFieldFormAnswers(schema, answers, { finalize: false })
  }, [schema, answers])

  useEffect(() => {
    if (!runtime || !task) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const opened = await openTaskForm(runtime, task, new Date().toISOString())
      if (cancelled) return
      if (!opened.ok || !opened.response) {
        setError(opened.reason ?? 'cannot_open')
        setLoading(false)
        return
      }
      setResponse(opened.response)
      setAnswers(opened.response.answers)
      setLastSaved(opened.response.last_saved_at)
      setError(null)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [runtime, task])

  const persistDraft = useCallback(
    async (nextAnswers: Record<string, unknown>) => {
      if (!runtime || !response) return
      const saved = await saveDraft(runtime, response, nextAnswers, new Date().toISOString())
      setResponse(saved)
      setLastSaved(saved.last_saved_at)
    },
    [runtime, response],
  )

  const debouncedSave = useRef(
    debounce((next: Record<string, unknown>) => {
      void persistDraft(next)
    }, 500),
  ).current

  const updateField = useCallback(
    (field: string, value: unknown) => {
      if (response && ['complete', 'complete_with_limitations', 'locked'].includes(response.status)) return
      setAnswers((prev) => {
        const next = { ...prev, [field]: value }
        debouncedSave(next)
        return next
      })
    },
    [response, debouncedSave],
  )

  const saveDraftNow = useCallback(async () => {
    await persistDraft(answers)
  }, [persistDraft, answers])

  const finalize = useCallback(
    async (allowLimitations = false) => {
      if (!runtime || !response) return { ok: false as const, reason: 'missing' }
      const result = await finalizeForm(runtime, response, answers, new Date().toISOString(), {
        allowLimitations,
      })
      if (result.response) setResponse(result.response)
      return result
    },
    [runtime, response, answers],
  )

  const revise = useCallback(
    async (reason: string) => {
      if (!runtime || !response) return null
      const draft = await createRevision(runtime, response, reason, new Date().toISOString())
      setResponse(draft)
      setAnswers(draft.answers)
      return draft
    },
    [runtime, response],
  )

  const readOnly = Boolean(
    response && ['complete', 'complete_with_limitations', 'locked'].includes(response.status),
  )

  return {
    loading,
    error,
    response,
    answers,
    schema,
    validation,
    locale,
    readOnly,
    lastSaved,
    updateField,
    saveDraftNow,
    finalize,
    revise,
    translateUi: (key: string) => translateUi(key, locale),
  }
}

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
    </div>
  )
}
