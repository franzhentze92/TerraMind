import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
import {
  captureContextFromPackage,
  createStructuredEvidenceFromForm,
} from '@/modules/field-operations/offline-evidence/engine/offline-evidence-capture'
import { OfflineEvidenceRepository } from '@/modules/field-operations/offline-evidence/offline-evidence.repository'
import type { LocalOfflinePackageRecord } from '@/modules/field-operations/offline-packages/offline-package.repository'

const formRepo = FieldFormRepository.createDefault()
const evidenceRepo = OfflineEvidenceRepository.createDefault()

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
      if (!runtime || !response || !pkg) return { ok: false as const, reason: 'missing' }
      const result = await finalizeForm(runtime, response, answers, new Date().toISOString(), {
        allowLimitations,
      })
      if (result.response) setResponse(result.response)
      if (result.ok && result.output) {
        const ctx = captureContextFromPackage(
          pkg,
          String(task?.id ?? response.task_id),
          runtime.tabId,
          new Date().toISOString(),
        )
        await createStructuredEvidenceFromForm({
          repo: evidenceRepo,
          ctx,
          output: result.output,
          pkg_payloads: pkg.payloads,
        })
      }
      return result
    },
    [runtime, response, answers, pkg, task],
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
