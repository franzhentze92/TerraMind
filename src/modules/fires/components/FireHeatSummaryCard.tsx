import { Link } from 'react-router-dom'
import { Flame, AlertTriangle, Satellite, ChevronRight } from 'lucide-react'
import { Card } from '@/shared/components/Card'
import { Badge } from '@/shared/components/Badge'
import { cn } from '@/shared/utils/cn'
import type { FireSummaryDto } from '@/modules/fires/types/fire.dto'
import { FirePipelineStatusLine } from '@/modules/fires/components/FirePipelineStatusLine'
import { useFirePipelineHealth } from '@/modules/fires/hooks/useFirePipelineHealth'
import {
  formatGuatemalaDateTime,
  formatGuatemalaTime,
  formatRelativeMinutes,
  riskLevelLabel,
} from '@/modules/fires/utils/format'

interface FireHeatSummaryCardProps {
  data?: FireSummaryDto
  isLoading?: boolean
  isError?: boolean
}

function Skeleton() {
  return (
    <Card padding="lg" className="animate-pulse bg-surface-2/60">
      <div className="h-3 w-28 rounded bg-surface-3" />
      <div className="mt-2 h-3 w-48 rounded bg-surface-3" />
      <div className="mt-6 h-8 w-40 rounded bg-surface-3" />
      <div className="mt-4 flex gap-3">
        <div className="h-4 w-24 rounded bg-surface-3" />
        <div className="h-4 w-28 rounded bg-surface-3" />
        <div className="h-4 w-32 rounded bg-surface-3" />
      </div>
      <div className="mt-6 h-16 rounded-lg bg-surface-3" />
    </Card>
  )
}

function riskBadgeVariant(risk: string): 'default' | 'warning' | 'critical' | 'accent' {
  if (risk === 'atencion' || risk === 'alto' || risk === 'critico') return 'critical'
  if (risk === 'observacion') return 'warning'
  return 'default'
}

export function FireHeatSummaryCard({ data, isLoading, isError }: FireHeatSummaryCardProps) {
  const pipelineHealth = useFirePipelineHealth()

  if (isLoading) return <Skeleton />

  if (isError) {
    return (
      <Card padding="lg" className="border-confidence-low/30 bg-confidence-low/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-confidence-low" />
          <div>
            <p className="text-sm font-medium text-text-primary">Focos de calor</p>
            <p className="mt-1 text-sm text-text-secondary">
              No se pudo cargar la actividad satelital. El resto del panel sigue disponible.
            </p>
          </div>
        </div>
      </Card>
    )
  }

  if (!data) return null

  const isStale = data.data_status.is_stale
  const ingestionPartial = data.data_status.is_partial
  const zeroEvents = data.events_count === 0
  const highlight = data.highest_priority_event
  const firmsAgo = formatRelativeMinutes(data.data_status.last_firms_ingestion_at)
  const acquisitionTime = data.data_status.latest_satellite_acquisition_at
    ? formatGuatemalaTime(data.data_status.latest_satellite_acquisition_at)
    : null
  const ds = data.data_status

  return (
    <Card
      padding="lg"
      className={cn(
        'border-border-subtle bg-surface-2/80',
        isStale && 'border-confidence-medium/40',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-confidence-medium" />
          <div>
            <p className="text-sm font-semibold text-text-primary">Focos de calor</p>
            <p className="text-xs text-text-secondary">
              Actividad satelital · últimas {data.window_hours} h
            </p>
          </div>
        </div>
        {ingestionPartial && (
          <Badge
            variant="warning"
            className="shrink-0"
            title={`${ds.sources_failed} fuente(s) fallida(s): ${ds.failed_source_names.join(', ') || 'desconocida'}`}
          >
            Ingesta parcial
          </Badge>
        )}
      </div>

      {isStale && (
        <p className="mt-3 rounded-md border border-confidence-medium/30 bg-confidence-medium/10 px-3 py-2 text-xs text-confidence-medium">
          Datos satelitales desactualizados.
          {data.data_status.last_successful_ingestion_at && (
            <>
              {' '}
              Última ingesta exitosa{' '}
              {formatRelativeMinutes(data.data_status.last_successful_ingestion_at)}.
            </>
          )}
        </p>
      )}

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          {zeroEvents ? (
            <p className="text-sm text-text-secondary">
              No se detectaron eventos térmicos dentro de Guatemala durante las últimas{' '}
              {data.window_hours} horas.
            </p>
          ) : (
            <>
              <p className="text-2xl font-semibold tracking-tight text-text-primary">
                {data.events_count} eventos térmicos
              </p>

              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-secondary">
                <span>{data.detections_count} detecciones satelitales</span>
                <span className="text-text-tertiary">·</span>
                <span>{data.attention_events_count} requiere atención</span>
                <span className="text-text-tertiary">·</span>
                <span>{data.multisatellite_events_count} multi-satélite</span>
                <span className="text-text-tertiary">·</span>
                <span>{data.departments_affected_count} departamentos con actividad</span>
              </div>
            </>
          )}
        </div>

        {highlight && !zeroEvents && (
          <div className="rounded-lg border border-border-subtle bg-surface-1/50 p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
              Prioridad actual
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-text-primary">
                {highlight.department ?? 'Sin departamento'}
              </span>
              <Badge variant={riskBadgeVariant(highlight.risk_level)}>
                {riskLevelLabel(highlight.risk_level)}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-text-secondary">
              {highlight.detection_count} detecciones · {highlight.satellite_count} satélites
            </p>
            <p className="mt-1 text-xs text-text-tertiary">
              Última detección: {formatGuatemalaDateTime(highlight.last_detected_at)}
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 space-y-2 border-t border-border-subtle pt-4 text-xs text-text-tertiary">
        <FirePipelineStatusLine
          health={pipelineHealth.data}
          isLoading={pipelineHealth.isLoading}
        />
        <p>
          Ingesta FIRMS: {firmsAgo ?? 'sin datos'} · {ds.sources_queried_successfully}/
          {ds.sources_expected} fuentes operativas
        </p>
        {ds.sources_with_detections < ds.sources_queried_successfully && (
          <p
            className="text-text-tertiary"
            title="Una fuente puede responder correctamente sin registrar detecciones en la ventana actual."
          >
            Detecciones de {ds.sources_with_detections} satélite
            {ds.sources_with_detections === 1 ? '' : 's'} en la ventana
          </p>
        )}
        {acquisitionTime && (
          <p className="flex items-center gap-1.5">
            <Satellite className="h-3 w-3" />
            Última adquisición satelital: {acquisitionTime}
          </p>
        )}
      </div>

      <Link
        to="/incendios"
        className="mt-4 flex items-center gap-1 text-xs font-medium text-accent hover:text-text-primary"
      >
        Ver análisis de incendios
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </Card>
  )
}
