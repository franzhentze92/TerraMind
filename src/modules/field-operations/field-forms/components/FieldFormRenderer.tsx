import type { FieldFormLocale, FieldFormSchemaRecord, ValidationMessage } from '@/modules/field-operations/field-forms/field-form.types'
import { translateFieldLabel } from '@/modules/field-operations/field-forms/i18n/field-form-i18n'
import { sanitizeTextInput } from '@/modules/field-operations/field-forms/field-form-copy-guard'

function fieldLabel(schema: FieldFormSchemaRecord, field: string, locale: FieldFormLocale): string {
  return translateFieldLabel(`${field}.label`, schema.localization, locale)
}

function widgetFor(schema: FieldFormSchemaRecord, field: string): string {
  const ui = schema.ui_schema[field] as { 'ui:widget'?: string } | undefined
  return ui?.['ui:widget'] ?? 'text'
}

function EnumSelect({
  value,
  options,
  onChange,
  disabled,
  id,
}: {
  value: string
  options: string[]
  onChange: (v: string) => void
  disabled?: boolean
  id: string
}) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border border-border-subtle bg-surface-1 px-3 py-2 text-sm"
    >
      <option value="">—</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  )
}

export function FieldFormRenderer({
  schema,
  answers,
  visibleFields,
  readOnly,
  locale,
  onChange,
  errors,
}: {
  schema: FieldFormSchemaRecord
  answers: Record<string, unknown>
  visibleFields: string[]
  readOnly?: boolean
  locale: FieldFormLocale
  onChange: (field: string, value: unknown) => void
  errors: ValidationMessage[]
}) {
  const props = schema.json_schema.properties as Record<string, Record<string, unknown>>

  return (
    <div className="space-y-4">
      {visibleFields.map((field) => {
        const def = props[field]
        if (!def) return null
        const widget = widgetFor(schema, field)
        const value = answers[field]
        const fieldErrors = errors.filter((e) => e.field === field)
        const label = fieldLabel(schema, field, locale)
        const inputId = `field-${field}`

        return (
          <div key={field} className="rounded border border-border-subtle/60 bg-surface-1/40 p-3">
            <label htmlFor={inputId} className="mb-1 block text-xs font-medium text-text-primary">
              {label}
              {(schema.json_schema.required as string[] | undefined)?.includes(field) && (
                <span className="ml-1 text-confidence-low">*</span>
              )}
            </label>

            {widget === 'textarea' && (
              <textarea
                id={inputId}
                rows={4}
                disabled={readOnly}
                value={typeof value === 'string' ? value : ''}
                onChange={(e) => onChange(field, sanitizeTextInput(e.target.value, 2000))}
                className="w-full rounded border border-border-subtle bg-surface-1 px-3 py-2 text-sm"
              />
            )}

            {(widget === 'select' || widget === 'yes_no_uncertain') && (
              <EnumSelect
                id={inputId}
                disabled={readOnly}
                value={typeof value === 'string' ? value : ''}
                options={(def.enum as string[]) ?? ['yes', 'no', 'uncertain']}
                onChange={(v) => onChange(field, v)}
              />
            )}

            {widget === 'datetime' && (
              <input
                id={inputId}
                type="datetime-local"
                disabled={readOnly}
                value={typeof value === 'string' ? value.slice(0, 16) : ''}
                onChange={(e) => onChange(field, new Date(e.target.value).toISOString())}
                className="w-full rounded border border-border-subtle bg-surface-1 px-3 py-2 text-sm"
              />
            )}

            {(widget === 'integer' || widget === 'number' || widget === 'distance') && (
              <input
                id={inputId}
                type="number"
                disabled={readOnly}
                value={typeof value === 'number' ? value : ''}
                onChange={(e) =>
                  onChange(field, widget === 'integer' ? parseInt(e.target.value, 10) : Number(e.target.value))
                }
                className="w-full rounded border border-border-subtle bg-surface-1 px-3 py-2 text-sm"
              />
            )}

            {widget === 'coordinates' && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  aria-label={`${label} latitud`}
                  type="number"
                  step="any"
                  disabled={readOnly}
                  placeholder="Lat"
                  value={typeof (value as { lat?: number })?.lat === 'number' ? (value as { lat: number }).lat : ''}
                  onChange={(e) =>
                    onChange(field, {
                      ...(typeof value === 'object' && value ? (value as Record<string, unknown>) : {}),
                      lat: Number(e.target.value),
                    })
                  }
                  className="rounded border border-border-subtle bg-surface-1 px-3 py-2 text-sm"
                />
                <input
                  aria-label={`${label} longitud`}
                  type="number"
                  step="any"
                  disabled={readOnly}
                  placeholder="Lng"
                  value={typeof (value as { lng?: number })?.lng === 'number' ? (value as { lng: number }).lng : ''}
                  onChange={(e) =>
                    onChange(field, {
                      ...(typeof value === 'object' && value ? (value as Record<string, unknown>) : {}),
                      lng: Number(e.target.value),
                    })
                  }
                  className="rounded border border-border-subtle bg-surface-1 px-3 py-2 text-sm"
                />
              </div>
            )}

            {widget === 'checklist' && (
              <div className="space-y-1">
                {((def.items as { enum?: string[] })?.enum ?? []).map((opt) => {
                  const selected = Array.isArray(value) ? value.includes(opt) : false
                  return (
                    <label key={opt} className="flex items-center gap-2 text-sm text-text-secondary">
                      <input
                        type="checkbox"
                        disabled={readOnly}
                        checked={selected}
                        onChange={(e) => {
                          const current = Array.isArray(value) ? [...value] : []
                          if (e.target.checked) current.push(opt)
                          else {
                            const idx = current.indexOf(opt)
                            if (idx >= 0) current.splice(idx, 1)
                          }
                          onChange(field, current)
                        }}
                      />
                      {opt}
                    </label>
                  )
                })}
              </div>
            )}

            {!['textarea', 'select', 'yes_no_uncertain', 'datetime', 'integer', 'number', 'distance', 'coordinates', 'checklist'].includes(widget) && (
              <input
                id={inputId}
                type="text"
                disabled={readOnly}
                value={typeof value === 'string' ? value : ''}
                onChange={(e) => onChange(field, sanitizeTextInput(e.target.value))}
                className="w-full rounded border border-border-subtle bg-surface-1 px-3 py-2 text-sm"
              />
            )}

            {fieldErrors.map((err) => (
              <p key={err.code} className="mt-1 text-xs text-confidence-low" role="alert">
                {err.message}
              </p>
            ))}
          </div>
        )
      })}
    </div>
  )
}
