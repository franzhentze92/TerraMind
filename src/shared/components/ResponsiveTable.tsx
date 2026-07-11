import type { ReactNode } from 'react'
import { cn } from '@/shared/utils/cn'

export interface ResponsiveTableColumn<T> {
  id: string
  header: string
  /** Priority columns stay visible in compact horizontal scroll mode. */
  priority?: boolean
  cell: (row: T) => ReactNode
  mobileLabel?: string
}

interface ResponsiveTableProps<T> {
  columns: ResponsiveTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  emptyMessage?: string
  className?: string
}

export function ResponsiveTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = 'Sin registros para mostrar.',
  className,
}: ResponsiveTableProps<T>) {
  if (rows.length === 0) {
    return <p className="text-sm text-text-secondary">{emptyMessage}</p>
  }

  return (
    <>
      <div className={cn('hidden overflow-x-auto md:block', className)}>
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wide text-text-tertiary">
              {columns.map((col) => (
                <th key={col.id} className="sticky top-0 bg-surface-1 px-3 py-2 font-medium">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-border-subtle/60 hover:bg-surface-2/30">
                {columns.map((col) => (
                  <td key={col.id} className="px-3 py-2 align-top text-text-secondary">
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            className="rounded-lg border border-border-subtle bg-surface-2/30 p-3 text-sm"
          >
            {columns.map((col) => (
              <div key={col.id} className="mb-2 last:mb-0">
                <p className="text-[10px] uppercase tracking-wide text-text-tertiary">
                  {col.mobileLabel ?? col.header}
                </p>
                <div className="text-text-secondary">{col.cell(row)}</div>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </>
  )
}
