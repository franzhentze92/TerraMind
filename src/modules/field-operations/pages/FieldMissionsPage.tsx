import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'

import { OfflinePackageRepository } from '@/modules/field-operations/offline-packages/offline-package.repository'
import { parsePackageTasks } from '@/modules/field-operations/field-forms/engine/package-compatibility'
import { FieldFormRepository } from '@/modules/field-operations/field-forms/field-form.repository'
import { labelSyncStatus, t } from '@/modules/field-operations/field-mobile/i18n/field-mobile-i18n'

export function FieldMissionsPage() {
  const [rows, setRows] = useState<
    Array<{ package_id: string; mission_title: string; pending: number; total: number; status: string }>
  >([])

  useEffect(() => {
    void (async () => {
      const packages = await OfflinePackageRepository.createDefault().list()
      const formRepo = FieldFormRepository.createDefault()
      const out = []
      for (const pkg of packages) {
        const tasks = parsePackageTasks(pkg).map((t) => ({
          id: String(t.id),
          task_type: String(t.task_type),
          schema_id: t.form_schema_id ? String(t.form_schema_id) : null,
        }))
        const prog = await formRepo.computeTaskProgress(pkg.package_id, tasks)
        const pending = prog.filter((p) => !['complete', 'complete_with_limitations'].includes(p.status)).length
        out.push({
          package_id: pkg.package_id,
          mission_title: pkg.mission_title,
          pending,
          total: tasks.length,
          status: pkg.local_status,
        })
      }
      setRows(out)
    })()
  }, [])

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="text-lg font-medium text-text-primary">Misiones en dispositivo</h1>
      <p className="mt-1 text-sm text-text-secondary">{t('saved_on_device', 'es')}</p>
      <ul className="mt-4 space-y-3">
        {rows.map((r) => (
          <li key={r.package_id} className="rounded-lg border border-border-subtle p-4">
            <p className="font-medium text-text-primary">{r.mission_title}</p>
            <p className="text-xs text-text-tertiary">
              {r.pending} / {r.total} tareas pendientes · {labelSyncStatus(r.status)}
            </p>
            <Link to={`/campo/paquetes/${r.package_id}`} className="mt-2 inline-block text-sm text-accent">
              Abrir workspace →
            </Link>
          </li>
        ))}
        {rows.length === 0 && (
          <p className="text-sm text-text-tertiary">Sin misiones descargadas. Use el demo en Inicio.</p>
        )}
      </ul>
    </div>
  )
}
