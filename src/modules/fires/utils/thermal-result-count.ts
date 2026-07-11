/**
 * Canonical result-count semantics for Actividad térmica list + filters.
 *
 * - serverFilteredTotal: total events matching current filters (backend count)
 * - currentPageItemCount: rows rendered on the active page
 * - visibleResultCount: single user-facing total (equals serverFilteredTotal)
 */
export interface ThermalResultCounts {
  serverFilteredTotal: number
  currentPageItemCount: number
  visibleResultCount: number
}

export function computeThermalResultCounts(input: {
  serverFilteredTotal: number | undefined
  currentPageItems: readonly unknown[]
  isFetching: boolean
  isPlaceholderData: boolean
}): ThermalResultCounts {
  const serverFilteredTotal = input.serverFilteredTotal ?? 0

  // While a new filter query is in flight, do not pair stale rows with a fresh total.
  if (input.isPlaceholderData && input.isFetching) {
    return {
      serverFilteredTotal,
      currentPageItemCount: 0,
      visibleResultCount: serverFilteredTotal,
    }
  }

  const currentPageItemCount = input.currentPageItems.length

  return {
    serverFilteredTotal,
    currentPageItemCount,
    visibleResultCount: serverFilteredTotal,
  }
}
