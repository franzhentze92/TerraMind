/**
 * "Panorama territorial" — bottom bar.
 *
 * Shows ONLY metrics with a real source: departments with active events and
 * municipalities under a rainfall-deficit signal. Population, communities and
 * infrastructure exposure are NOT computed with real sources yet, so they are
 * hidden (not shown as zero) per the honesty rule. Language stays cautious
 * ("con eventos", "con señal"), never "afectados" from a mere spatial signal.
 *
 * Per-type queries reuse the exact query keys used by the map, so React Query
 * dedupes them — no duplicate network requests.
 */
import { Link } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import { useNationalSituation } from '../NationalSituationContext'
import { useEnvironmentalEvents } from '@/modules/environmental-events/hooks/useEnvironmentalEvents'
import type { EnvironmentalEventType } from '@/modules/environmental-events/types/taxonomy'

interface TypeTerritory {
  departments: string[]
  municipalities: string[]
}

function TypeTerritoryProbe({
  type,
  since,
  onResult,
}: {
  type: EnvironmentalEventType
  since: string
  onResult: (type: EnvironmentalEventType, data: TypeTerritory) => void
}) {
  // Same shared window/limit as the map → deduped single request, same events.
  const query = useEnvironmentalEvents({ type, since, limit: 100 })
  const data = query.data

  useEffect(() => {
    if (!data) return
    const departments = new Set<string>()
    const municipalities = new Set<string>()
    for (const e of data.items) {
      if (e.territory?.departmentName) departments.add(e.territory.departmentName)
      const attrs = e.attributes as { municipalityNames?: string[] }
      if (Array.isArray(attrs.municipalityNames)) {
        for (const m of attrs.municipalityNames) municipalities.add(m)
      }
    }
    onResult(type, {
      departments: [...departments],
      municipalities: [...municipalities],
    })
  }, [data, type, onResult])

  return null
}

export function TerritorialPanorama() {
  const { eventTypes, eventsWindowSince } = useNationalSituation()
  const { types } = eventTypes
  const [byType, setByType] = useState<Record<string, TypeTerritory>>({})

  const handleResult = useCallback((type: EnvironmentalEventType, data: TypeTerritory) => {
    setByType((prev) => {
      const existing = prev[type]
      if (
        existing &&
        existing.departments.join('|') === data.departments.join('|') &&
        existing.municipalities.join('|') === data.municipalities.join('|')
      ) {
        return prev
      }
      return { ...prev, [type]: data }
    })
  }, [])

  const allDepartments = new Set<string>()
  const allMunicipalities = new Set<string>()
  for (const t of types) {
    const d = byType[t.type]
    if (!d) continue
    for (const dep of d.departments) allDepartments.add(dep)
    for (const m of d.municipalities) allMunicipalities.add(m)
  }

  const metrics: Array<{ key: string; label: string; value: string }> = []
  if (allDepartments.size > 0) {
    metrics.push({
      key: 'departments',
      label: 'Departamentos con eventos',
      value: String(allDepartments.size),
    })
  }
  if (allMunicipalities.size > 0) {
    metrics.push({
      key: 'municipalities',
      label: 'Municipios con señal',
      value: String(allMunicipalities.size),
    })
  }

  return (
    <section
      className="mt-6 rounded-xl border border-border-subtle bg-surface-2/40 px-4 py-3"
      data-testid="territorial-panorama"
      aria-label="Panorama territorial"
    >
      {types.map((t) => (
        <TypeTerritoryProbe
          key={t.type}
          type={t.type}
          since={eventsWindowSince}
          onResult={handleResult}
        />
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Panorama territorial
        </p>
        <Link to="/territorio" className="text-[10px] text-accent hover:underline">
          Ver análisis territorial →
        </Link>
      </div>

      {metrics.length === 0 ? (
        <p className="mt-3 text-xs text-text-secondary">
          No hay métricas territoriales disponibles con fuentes reales para el periodo actual.
        </p>
      ) : (
        <dl className="mt-3 flex flex-wrap gap-x-10 gap-y-3">
          {metrics.map((m) => (
            <div key={m.key}>
              <dt className="text-[11px] text-text-tertiary">{m.label}</dt>
              <dd className="text-xl font-semibold text-text-primary">{m.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
