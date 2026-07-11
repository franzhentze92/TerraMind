import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ModuleHeader } from '@/shared/components'
import { useIncidentStory } from '../hooks/useExecutiveDemo'
import { IncidentStoryTimeline } from '../components/StoryTimeline'
import { DemoBanner } from '../components/ExecutiveDashboardPanels'
import { incidentReportPdfUrl } from '../api/executive-demo-api'

export function IncidentStoryPage() {
  const { incidentId } = useParams()
  const [includeDemo, setIncludeDemo] = useState(true)
  const query = useIncidentStory(incidentId, includeDemo)
  const story = query.data

  if (query.isLoading) {
    return <p className="p-6 text-sm text-text-tertiary">Cargando historia del incidente…</p>
  }
  if (!story) {
    return (
      <div className="p-6">
        <p className="text-sm text-confidence-low">Historia no disponible.</p>
        <p className="mt-2 text-xs text-text-tertiary">
          Si el incidente es legacy, active &quot;Mostrar demostraciones&quot; para el piloto interno.
        </p>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeDemo} onChange={(e) => setIncludeDemo(e.target.checked)} />
          Mostrar demostraciones
        </label>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 md:p-6">
      <ModuleHeader
        title="Historia del incidente"
        description="Narrativa cronológica · observación → respuesta"
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input type="checkbox" checked={includeDemo} onChange={(e) => setIncludeDemo(e.target.checked)} />
          Mostrar demostraciones
        </label>
        <Link
          to={`/incidentes/${incidentId}`}
          className="rounded border border-border-subtle px-3 py-1 text-xs hover:border-accent/40"
        >
          Ver incidente
        </Link>
        <Link
          to={`/informes/incidentes/${incidentId}`}
          className="rounded border border-border-subtle px-3 py-1 text-xs hover:border-accent/40"
        >
          Generar informe
        </Link>
        <a
          href={incidentReportPdfUrl(incidentId!, includeDemo)}
          className="rounded bg-accent/20 px-3 py-1 text-xs text-accent hover:bg-accent/30"
        >
          Descargar PDF
        </a>
      </div>

      {story.is_internal_demo && <DemoBanner />}

      <div className="mb-4 rounded-lg border border-border-subtle bg-surface-2/30 px-4 py-3">
        <p className="text-sm font-medium text-text-primary">{story.coverage.label}</p>
        {story.coverage.present_stage_labels.length > 0 && (
          <p className="mt-1 text-xs text-text-secondary">
            Presentes: {story.coverage.present_stage_labels.join(' · ')}
          </p>
        )}
        {story.coverage.missing_stage_labels.length > 0 && (
          <p className="mt-1 text-xs text-text-tertiary">
            Faltantes: {story.coverage.missing_stage_labels.join(' · ')}
          </p>
        )}
        <p className="mt-2 text-xs text-text-tertiary">
          Clasificación: {story.classification.replace('_', ' ')}
          {story.is_legacy && ' · Incidente legacy (sin organization_id)'}
        </p>
      </div>

      <IncidentStoryTimeline stages={story.stages} />
    </div>
  )
}
